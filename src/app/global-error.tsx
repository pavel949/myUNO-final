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
    <html lang="en">
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold mb-4">
              {error.digest ? `Error ${error.digest}` : 'Something went wrong'}
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-8 text-base">
              {error.message || 'An unexpected error occurred in the root layout. Our team has been notified.'}
            </p>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => reset()}>
                Try again
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
              >
                Back to home
              </Button>
            </div>

            {/* Development: show error details. */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800 text-left">
                <p className="text-xs font-mono text-red-600 dark:text-red-300 whitespace-pre-wrap break-words">
                  {error.stack}
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
