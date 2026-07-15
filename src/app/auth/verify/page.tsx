import Link from 'next/link';
import { verifyEmail } from '@/modules/auth';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  searchParams: { token?: string };
}

export default async function VerifyEmailPage({ searchParams }: VerifyPageProps) {
  const labels = await getLabels({
    'auth.verify.title': 'Email verification',
    'auth.verify.success': 'Your email is verified. Welcome to myUNO!',
    'auth.verify.failure':
      'This verification link is invalid or has expired. Please request a new one.',
    'auth.verify.go_login': 'Go to log in',
  });

  let verified = false;
  if (searchParams.token) {
    try {
      await verifyEmail(searchParams.token);
      verified = true;
    } catch {
      verified = false;
    }
  }

  return (
    <main className="min-h-screen bg-surface-background flex items-start justify-center px-24 py-64">
      <div className="w-full max-w-md bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <h1 className="text-heading-2 font-bold text-text-ink mb-16">
          {labels['auth.verify.title']}
        </h1>
        <p className="text-body text-text-secondary mb-32">
          {verified ? labels['auth.verify.success'] : labels['auth.verify.failure']}
        </p>
        <Link href="/login" className="text-brand-andaman font-semibold hover:underline">
          {labels['auth.verify.go_login']}
        </Link>
      </div>
    </main>
  );
}
