export {
  register,
  login,
  requestPasswordReset,
  confirmPasswordReset,
  verifyEmail,
  claimAccount,
} from './auth';

export { sendEmail } from './email';

export type {
  RegisterInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
  VerifyEmailInput,
  ClaimAccountInput,
  AuthError,
} from './types';
