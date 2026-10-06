import { getLabels } from '@/lib/i18n';
import { PageHeading } from '@/components/premium/StitchPage';
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
    <main className="stitch-workspace flex items-start justify-center px-24 py-64">
      <div className="stitch-panel w-full max-w-md p-32 text-center">
        <PageHeading title={labels['auth.verify.title']} />
        <AuthVerifyClient token={searchParams.token} labels={labels} />
      </div>
    </main>
  );
}
