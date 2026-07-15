import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

export default async function NotFound() {
  const labels = await getLabels({
    'common.not_found.title': 'Page not found',
    'common.not_found.body': "The page you're looking for doesn't exist or has moved.",
    'common.not_found.home': 'Back to home',
  });

  return (
    <main className="min-h-screen bg-surface-background flex items-center justify-center px-24">
      <div className="max-w-md w-full bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <p className="text-heading-1 font-bold text-brand-andaman mb-16">404</p>
        <h1 className="text-heading-2 font-bold text-text-ink mb-12">
          {labels['common.not_found.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">
          {labels['common.not_found.body']}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-48 px-24 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep"
        >
          {labels['common.not_found.home']}
        </Link>
      </div>
    </main>
  );
}
