'use client';

// Root error boundary. Content-key note: error boundaries render when the
// server (and thus the content layer) may be unreachable, so these two
// strings are the sanctioned hardcoded fallbacks (doc 05 §1 exception —
// mirrored by keys common.state.error.title / .description for all other
// surfaces).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-surface-background flex items-center justify-center px-24">
      <div className="max-w-md w-full bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <div className="text-heading-2 mb-16" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-heading-2 font-bold text-text-ink mb-12">
          Something went wrong
        </h1>
        <p className="text-body text-text-secondary mb-24">
          Please try again. If the problem continues, contact us and we will help.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center h-48 px-24 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
