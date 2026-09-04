'use client';

/**
 * Root-level error boundary for errors thrown in the root layout itself.
 * Without this, an error in layout.tsx falls back to Next's default error page.
 * Doc 06 §5: the branded error page is the design system floor.
 * T-043: Implement full design system integration for this page.
 */

import { useEffect } from 'react';
import { Button } from '@/components/Button';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Optionally log the error to a monitoring service.
    console.error('Root layout error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-surface-background flex items-center justify-center px-24">
      <div className="max-w-md w-full bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <h1 className="text-heading-2 font-bold text-text-ink mb-12">
          {error.digest ? `Error ${error.digest}` : 'Something went wrong'}
        </h1>

        <p className="text-body text-text-secondary mb-24">
          {error.message || 'An unexpected error occurred in the root layout. Please try again.'}
        </p>

        <div className="flex gap-12 justify-center">
          <Button onClick={() => reset()}>
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="secondary"
          >
            Back to home
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-16 p-12 bg-state-error-soft rounded border border-state-error text-left">
            <p className="text-small text-state-error whitespace-pre-wrap break-words">
              {error.stack}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
