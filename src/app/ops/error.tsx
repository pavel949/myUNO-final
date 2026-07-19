'use client';

import { ErrorState } from '@/components/StateComponents';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OpsErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <ErrorState
          title="Unable to load ops board"
          description={error.message || 'An error occurred while loading the operations board.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
