import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  const labels = await getLabels({
    'auth.login.title': 'Welcome back',
    'auth.login.subtitle': 'Log in to manage your stays, units, and services.',
    'auth.login.email': 'Email',
    'auth.login.password': 'Password',
    'auth.login.submit': 'Log in',
    'auth.login.error_generic': 'Login failed. Please try again.',
    'auth.login.error_invalid_credentials': 'Invalid email or password.',
    'auth.login.error_rate_limited': 'Too many attempts. Please try again shortly.',
    'auth.login.no_account': "Don't have an account?",
    'auth.login.register_link': 'Sign up',
    'auth.login.forgot_password': 'Forgot your password?',
    'auth.login.google_button': 'Continue with Google',
    'auth.login.divider': 'Or continue with email',
  });

  return (
    <main className="min-h-screen bg-surface-ivory flex items-center justify-center px-16 py-32 sm:px-24 sm:py-48">
      <div className="w-full max-w-xl bg-surface-paper border border-border-line rounded-lg shadow-card p-24 sm:p-32">
        <h1 className="font-display text-display font-semibold text-text-ink mb-12">
          {labels['auth.login.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">{labels['auth.login.subtitle']}</p>
        <Suspense>
          <LoginForm
            labels={{
              email: labels['auth.login.email'],
              password: labels['auth.login.password'],
              submit: labels['auth.login.submit'],
              errorGeneric: labels['auth.login.error_generic'],
              errorInvalidCredentials: labels['auth.login.error_invalid_credentials'],
              errorRateLimited: labels['auth.login.error_rate_limited'],
              noAccount: labels['auth.login.no_account'],
              registerLink: labels['auth.login.register_link'],
              forgotPassword: labels['auth.login.forgot_password'],
              googleButton: labels['auth.login.google_button'],
              divider: labels['auth.login.divider'],
            }}
          />
        </Suspense>
      </div>
    </main>
  );
}
