export {
  register,
  login,
  requestPasswordReset,
  confirmPasswordReset,
  verifyEmail,
  claimAccount,
} from './auth';

export { sendEmail } from './email';

export {
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from './session';

export { AuthError, isAuthError } from './types';
export type {
  RegisterInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
  VerifyEmailInput,
  ClaimAccountInput,
} from './types';
