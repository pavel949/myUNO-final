import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import {
  RegisterInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
  AuthError,
} from './types';

const BCRYPT_COST = 12;

// --- Hash utilities ---

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// --- Token utilities ---

function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// --- Helpers ---

function createAuthError(code: string, message: string, statusCode: number): AuthError {
  const error = new Error(message) as AuthError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// --- Register ---

export async function register(input: RegisterInput) {
  const { firstName, lastName, email, password, locale } = input;

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw createAuthError('weak_password', passwordValidation.errors.join(', '), 400);
  }

  const existingIdentity = await prisma.identity.findUnique({
    where: { email },
  });

  if (existingIdentity) {
    throw createAuthError('email_exists', 'Email already registered', 409);
  }

  const hashedPassword = await hashPassword(password);

  const identity = await prisma.identity.create({
    data: {
      firstName,
      lastName,
      email,
      hashedPassword,
      preferredLocale: locale,
      status: 'active',
    },
  });

  const token = generateToken();
  const tokenHash = hashToken(token);
  const { getConfig } = await import('@/modules/config');
  const ttlMinutes = (await getConfig(prisma, 'auth.token_ttl_minutes.email_verify')) || 1440;

  await prisma.oneTimeToken.create({
    data: {
      identityId: identity.id,
      purpose: 'email_verify',
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email',
    html: `
      <p>Welcome, ${firstName}!</p>
      <p><a href="${verifyUrl}">Click here to verify your email</a></p>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in ${ttlMinutes} minutes.</p>
    `,
  });

  return identity;
}

// --- Login ---

export async function login(input: LoginInput) {
  const { email, password } = input;

  const identity = await prisma.identity.findUnique({
    where: { email },
  });

  if (!identity) {
    throw createAuthError('invalid_credentials', 'Invalid email or password', 401);
  }

  if (identity.status === 'blocked') {
    throw createAuthError('identity_blocked', 'This account has been blocked', 403);
  }

  if (!identity.hashedPassword) {
    throw createAuthError(
      'no_password',
      'This account uses OAuth or has not set a password yet',
      400
    );
  }

  const passwordValid = await verifyPassword(password, identity.hashedPassword);
  if (!passwordValid) {
    throw createAuthError('invalid_credentials', 'Invalid email or password', 401);
  }

  return identity;
}

// --- Password Reset ---

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const { email } = input;

  const identity = await prisma.identity.findUnique({
    where: { email },
  });

  if (identity && identity.status !== 'blocked') {
    await prisma.oneTimeToken.updateMany({
      where: {
        identityId: identity.id,
        purpose: 'password_reset',
        consumedAt: null,
      },
      data: {
        expiresAt: new Date(),
      },
    });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const { getConfig } = await import('@/modules/config');
    const ttlMinutes = (await getConfig(prisma, 'auth.token_ttl_minutes.password_reset')) || 60;

    await prisma.oneTimeToken.create({
      data: {
        identityId: identity.id,
        purpose: 'password_reset',
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Reset your password',
      html: `
        <p>Click to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link expires in ${ttlMinutes} minutes.</p>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });
  }

  return { success: true };
}

export async function confirmPasswordReset(input: PasswordResetConfirmInput) {
  const { token, newPassword } = input;

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw createAuthError('weak_password', passwordValidation.errors.join(', '), 400);
  }

  const tokenHash_ = hashToken(token);
  const oneTimeToken = await prisma.oneTimeToken.findFirst({
    where: {
      tokenHash: tokenHash_,
      purpose: 'password_reset',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { identity: true },
  });

  if (!oneTimeToken) {
    throw createAuthError('invalid_token', 'Invalid or expired reset link', 401);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.identity.update({
      where: { id: oneTimeToken.identityId },
      data: { hashedPassword },
    }),
    prisma.oneTimeToken.update({
      where: { id: oneTimeToken.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { success: true };
}

// --- Verify Email ---

export async function verifyEmail(token: string) {
  const tokenHash_ = hashToken(token);
  const oneTimeToken = await prisma.oneTimeToken.findFirst({
    where: {
      tokenHash: tokenHash_,
      purpose: 'email_verify',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { identity: true },
  });

  if (!oneTimeToken) {
    throw createAuthError('invalid_token', 'Invalid or expired verification link', 401);
  }

  await prisma.$transaction([
    prisma.identity.update({
      where: { id: oneTimeToken.identityId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.oneTimeToken.update({
      where: { id: oneTimeToken.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { success: true };
}

// --- Claim Account ---

export async function claimAccount(token: string, password: string) {
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw createAuthError('weak_password', passwordValidation.errors.join(', '), 400);
  }

  const tokenHash_ = hashToken(token);
  const oneTimeToken = await prisma.oneTimeToken.findFirst({
    where: {
      tokenHash: tokenHash_,
      purpose: 'account_claim',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { identity: true },
  });

  if (!oneTimeToken) {
    throw createAuthError('invalid_token', 'Invalid or expired claim link', 401);
  }

  const identity = oneTimeToken.identity;

  if (identity.status !== 'invited') {
    throw createAuthError('invalid_status', 'Account is not in invited status', 400);
  }

  const hashedPassword = await hashPassword(password);

  await prisma.$transaction([
    prisma.identity.update({
      where: { id: identity.id },
      data: {
        hashedPassword,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.oneTimeToken.update({
      where: { id: oneTimeToken.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { success: true };
}
