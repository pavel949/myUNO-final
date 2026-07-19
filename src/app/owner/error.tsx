'use client';

import { ErrorState } from '@/components/StateComponents';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OwnerErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <ErrorState
          title="Unable to load dashboard"
          description={error.message || 'An error occurred while loading your owner dashboard.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
