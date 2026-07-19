'use client';

import { ErrorState } from '@/components/StateComponents';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MCErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <ErrorState
          title="Unable to load MC dashboard"
          description={error.message || 'An error occurred while loading the management company dashboard.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
