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

export interface AuthError extends Error {
  code: string;
  statusCode: number;
}

export interface TokenData {
  raw: string;
  hash: string;
}

export type TokenPurpose = OneTimeTokenPurpose;
