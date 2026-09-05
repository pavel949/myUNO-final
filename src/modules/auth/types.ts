import { OneTimeTokenPurpose } from '@prisma/client';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  locale: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PasswordResetRequestInput {
  email: string;
  /** Origin the reset link should open. Prefer the host the user posted from. */
  baseUrl?: string;
}

export class AuthError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  if (error instanceof AuthError) return true;
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { code?: unknown; statusCode?: unknown };
  return typeof candidate.code === 'string' && typeof candidate.statusCode === 'number';
}

export interface PasswordResetConfirmInput {
  token: string;
  newPassword: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface ClaimAccountInput {
  token: string;
  password: string;
}

export interface TokenData {
  raw: string;
  hash: string;
}

export type TokenPurpose = OneTimeTokenPurpose;
