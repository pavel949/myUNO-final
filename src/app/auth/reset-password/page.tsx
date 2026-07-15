import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const labels = await getLabels({
    'auth.reset.title': 'Reset your password',
    'auth.reset.request_subtitle':
      "Enter your email and we'll send you a reset link.",
    'auth.reset.confirm_subtitle': 'Choose a new password for your account.',
    'auth.reset.email': 'Email',
    'auth.reset.new_password': 'New password',
    'auth.reset.password_help':
      'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.',
    'auth.reset.request_submit': 'Send reset link',
    'auth.reset.confirm_submit': 'Set new password',
    'auth.reset.request_sent':
      'If that email is registered, a reset link is on its way.',
    'auth.reset.success': 'Password updated. You can now log in.',
    'auth.reset.error_generic': 'Something went wrong. Please try again.',
    'auth.reset.back_to_login': 'Back to log in',
  });

  return (
    <main className="min-h-screen bg-surface-background flex items-start justify-center px-24 py-64">
      <div className="w-full max-w-md bg-surface-paper border border-border-line rounded-lg p-32">
        <Suspense>
          <ResetPasswordForm
            labels={{
              title: labels['auth.reset.title'],
              requestSubtitle: labels['auth.reset.request_subtitle'],
              confirmSubtitle: labels['auth.reset.confirm_subtitle'],
              email: labels['auth.reset.email'],
              newPassword: labels['auth.reset.new_password'],
              passwordHelp: labels['auth.reset.password_help'],
              requestSubmit: labels['auth.reset.request_submit'],
              confirmSubmit: labels['auth.reset.confirm_submit'],
              requestSent: labels['auth.reset.request_sent'],
              success: labels['auth.reset.success'],
              errorGeneric: labels['auth.reset.error_generic'],
              backToLogin: labels['auth.reset.back_to_login'],
            }}
          />
        </Suspense>
      </div>
    </main>
  );
}
