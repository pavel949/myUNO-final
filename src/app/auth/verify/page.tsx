import { getLabels } from '@/lib/i18n';
import AuthVerifyClient from './verify-client';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  searchParams: { token?: string };
}

export default async function VerifyEmailPage({ searchParams }: VerifyPageProps) {
  const labels = await getLabels({
    'auth.verify.title': 'Email verification',
    'auth.verify.loading': 'Verifying your email…',
    'auth.verify.success': 'Your email is verified. Welcome to myUNO!',
    'auth.verify.failure':
      'This verification link is invalid or has expired. Please request a new one.',
    'auth.verify.go_login': 'Go to log in',
  });

  return (
    <main className="min-h-screen bg-surface-ivory flex items-start justify-center px-24 py-64">
      <div className="w-full max-w-md bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <h1 className="text-heading-2 font-bold text-text-ink mb-16">
          {labels['auth.verify.title']}
        </h1>
        <AuthVerifyClient token={searchParams.token} labels={labels} />
      </div>
    </main>
  );
}
