import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';

export default async function RegisterPage(props: { searchParams?: Promise<{ next?: string | string[] }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (user) {
    redirect(safeNextPath(typeof searchParams?.next === 'string' ? searchParams.next : null) || '/');
  }

  const labels = await getLabels({
    'auth.register.title': 'Create your account',
    'auth.register.subtitle': 'Book stays, order services, and manage your units in one place.',
    'auth.register.first_name': 'First name',
    'auth.register.last_name': 'Last name',
    'auth.register.email': 'Email',
    'auth.register.password': 'Password',
    'auth.register.password_help':
      'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.',
    'auth.register.submit': 'Sign up',
    'auth.register.error_generic': 'Registration failed. Please try again.',
    'auth.register.have_account': 'Already have an account?',
    'auth.register.login_link': 'Log in',
  });

  return (
    <main className="stitch-workspace flex min-h-screen items-start justify-center px-16 py-32 sm:px-24 sm:py-48">
      <div className="stitch-panel w-full max-w-xl p-24 sm:p-32">
        <h1 className="font-display text-display font-semibold text-text-ink mb-8">
          {labels['auth.register.title']}
        </h1>
        <p className="text-body text-text-secondary mb-32">
          {labels['auth.register.subtitle']}
        </p>
        <Suspense>
          <RegisterForm
          labels={{
            firstName: labels['auth.register.first_name'],
            lastName: labels['auth.register.last_name'],
            email: labels['auth.register.email'],
            password: labels['auth.register.password'],
            passwordHelp: labels['auth.register.password_help'],
            submit: labels['auth.register.submit'],
            errorGeneric: labels['auth.register.error_generic'],
            haveAccount: labels['auth.register.have_account'],
            loginLink: labels['auth.register.login_link'],
          }}
          />
        </Suspense>
      </div>
    </main>
  );
}
