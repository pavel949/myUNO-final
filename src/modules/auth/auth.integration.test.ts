import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db as prisma, resetDb } from '@/test/util';
import {
  register,
  login,
  requestPasswordReset,
  confirmPasswordReset,
  verifyEmail,
  claimAccount,
} from './index';

describe('Auth module', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('register', () => {
    it('creates a new identity with verified password', async () => {
      const identity = await register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        locale: 'en',
      });

      expect(identity.firstName).toBe('John');
      expect(identity.lastName).toBe('Doe');
      expect(identity.email).toBe('john@example.com');
      expect(identity.emailVerifiedAt).toBeNull();
      expect(identity.hashedPassword).toBeTruthy();
      expect(identity.hashedPassword).not.toBe('SecurePass123');
      expect(identity.preferredLocale).toBe('en');
      expect(identity.status).toBe('active');
    });

    it('creates a verification token', async () => {
      await register({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'SecurePass123',
        locale: 'en',
      });

      const identity = await prisma.identity.findUnique({
        where: { email: 'jane@example.com' },
      });

      const token = await prisma.oneTimeToken.findFirst({
        where: {
          identityId: identity!.id,
          purpose: 'email_verify',
          consumedAt: null,
        },
      });

      expect(token).toBeTruthy();
      expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects duplicate email', async () => {
      await register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        locale: 'en',
      });

      await expect(
        register({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'AnotherPass123',
          locale: 'en',
        })
      ).rejects.toMatchObject({ code: 'email_exists' });
    });

    it('rejects weak password', async () => {
      await expect(
        register({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'weak',
          locale: 'en',
        })
      ).rejects.toMatchObject({ code: 'weak_password' });
    });
  });

  describe('login', () => {
    let identityEmail = 'test@example.com';
    let identityPassword = 'SecurePass123';

    beforeEach(async () => {
      await register({
        firstName: 'Test',
        lastName: 'User',
        email: identityEmail,
        password: identityPassword,
        locale: 'en',
      });
    });

    it('logs in with correct credentials', async () => {
      const identity = await login({
        email: identityEmail,
        password: identityPassword,
      });

      expect(identity.email).toBe(identityEmail);
      expect(identity.firstName).toBe('Test');
    });

    it('rejects invalid email', async () => {
      await expect(
        login({
          email: 'nonexistent@example.com',
          password: identityPassword,
        })
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    });

    it('rejects invalid password', async () => {
      await expect(
        login({
          email: identityEmail,
          password: 'WrongPassword123',
        })
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    });

    it('rejects blocked identity', async () => {
      await prisma.identity.update({
        where: { email: identityEmail },
        data: { status: 'blocked' },
      });

      await expect(
        login({
          email: identityEmail,
          password: identityPassword,
        })
      ).rejects.toMatchObject({ code: 'identity_blocked' });
    });
  });

  describe('password reset flow', () => {
    let identityEmail = 'test@example.com';
    let newPassword = 'NewSecurePass123';

    beforeEach(async () => {
      await register({
        firstName: 'Test',
        lastName: 'User',
        email: identityEmail,
        password: 'OldPassword123',
        locale: 'en',
      });
    });

    it('sends password reset email', async () => {
      const result = await requestPasswordReset({ email: identityEmail });
      expect(result.success).toBe(true);

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const token = await prisma.oneTimeToken.findFirst({
        where: {
          identityId: identity!.id,
          purpose: 'password_reset',
          consumedAt: null,
        },
      });

      expect(token).toBeTruthy();
    });

    it('never leaks email existence', async () => {
      const result = await requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('invalidates previous reset tokens', async () => {
      await requestPasswordReset({ email: identityEmail });

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const token1 = await prisma.oneTimeToken.findFirst({
        where: {
          identityId: identity!.id,
          purpose: 'password_reset',
        },
        orderBy: { createdAt: 'desc' },
      });

      // Request again
      await requestPasswordReset({ email: identityEmail });

      const token2 = await prisma.oneTimeToken.findFirst({
        where: {
          identityId: identity!.id,
          purpose: 'password_reset',
        },
        orderBy: { createdAt: 'desc' },
      });

      // Token1 should be expired
      const updatedToken1 = await prisma.oneTimeToken.findUnique({
        where: { id: token1!.id },
      });

      expect(updatedToken1!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(token2!.id).not.toBe(token1!.id);
    });

    it('resets password with valid token', async () => {
      await requestPasswordReset({ email: identityEmail });

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const tokenRecord = await prisma.oneTimeToken.findFirst({
        where: {
          identityId: identity!.id,
          purpose: 'password_reset',
        },
      });

      // We need to get the raw token, but since it's hashed we can't
      // So we'll create a new one directly for testing
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity!.id,
          purpose: 'password_reset',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const result = await confirmPasswordReset({
        token,
        newPassword,
      });

      expect(result.success).toBe(true);

      const updatedIdentity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const { verifyPassword } = await import('./utils/hash');
      const passwordMatches = await verifyPassword(newPassword, updatedIdentity!.hashedPassword!);
      expect(passwordMatches).toBe(true);
    });

    it('rejects expired token', async () => {
      const { generateToken } = await import('./utils/token');
      const { hashToken } = await import('./utils/token');

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity!.id,
          purpose: 'password_reset',
          tokenHash,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await expect(
        confirmPasswordReset({
          token,
          newPassword,
        })
      ).rejects.toMatchObject({ code: 'invalid_token' });
    });
  });

  describe('verify email', () => {
    let identityEmail = 'test@example.com';

    beforeEach(async () => {
      await register({
        firstName: 'Test',
        lastName: 'User',
        email: identityEmail,
        password: 'SecurePass123',
        locale: 'en',
      });
    });

    it('marks email as verified', async () => {
      const { generateToken } = await import('./utils/token');
      const { hashToken } = await import('./utils/token');

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity!.id,
          purpose: 'email_verify',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const result = await verifyEmail(token);
      expect(result.success).toBe(true);

      const updatedIdentity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      expect(updatedIdentity!.emailVerifiedAt).toBeTruthy();
    });

    it('consumes token after verification', async () => {
      const { generateToken } = await import('./utils/token');
      const { hashToken } = await import('./utils/token');

      const identity = await prisma.identity.findUnique({
        where: { email: identityEmail },
      });

      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity!.id,
          purpose: 'email_verify',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await verifyEmail(token);

      // Try to verify again with same token
      await expect(verifyEmail(token)).rejects.toMatchObject({ code: 'invalid_token' });
    });
  });

  describe('claim account', () => {
    it('activates invited identity with password', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Invited',
          lastName: 'User',
          email: 'invited@example.com',
          status: 'invited',
        },
      });

      const { generateToken } = await import('./utils/token');
      const { hashToken } = await import('./utils/token');

      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity.id,
          purpose: 'account_claim',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const result = await claimAccount(token, 'NewPassword123');

      expect(result.success).toBe(true);

      const updatedIdentity = await prisma.identity.findUnique({
        where: { id: identity.id },
      });

      expect(updatedIdentity!.status).toBe('active');
      expect(updatedIdentity!.emailVerifiedAt).toBeTruthy();
      expect(updatedIdentity!.hashedPassword).toBeTruthy();
    });

    it('rejects non-invited identity', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Active',
          lastName: 'User',
          email: 'active@example.com',
          status: 'active',
          hashedPassword: 'some_hash',
        },
      });

      const { generateToken } = await import('./utils/token');
      const { hashToken } = await import('./utils/token');

      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.oneTimeToken.create({
        data: {
          identityId: identity.id,
          purpose: 'account_claim',
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await expect(
        claimAccount(token, 'NewPassword123')
      ).rejects.toMatchObject({ code: 'invalid_status' });
    });
  });
});
