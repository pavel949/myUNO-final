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
    'auth.login.no_account': "Don't have an account?",
    'auth.login.register_link': 'Sign up',
    'auth.login.forgot_password': 'Forgot your password?',
  });

  return (
    <main className="min-h-screen bg-surface-background flex items-start justify-center px-24 py-64">
      <div className="w-full max-w-md bg-surface-paper border border-border-line rounded-lg p-32">
        <h1 className="text-heading-2 font-bold text-text-ink mb-8">
          {labels['auth.login.title']}
        </h1>
        <p className="text-body text-text-secondary mb-32">{labels['auth.login.subtitle']}</p>
        <Suspense>
          <LoginForm
            labels={{
              email: labels['auth.login.email'],
              password: labels['auth.login.password'],
              submit: labels['auth.login.submit'],
              errorGeneric: labels['auth.login.error_generic'],
              noAccount: labels['auth.login.no_account'],
              registerLink: labels['auth.login.register_link'],
              forgotPassword: labels['auth.login.forgot_password'],
            }}
          />
        </Suspense>
      </div>
    </main>
  );
}
