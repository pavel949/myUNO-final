export default function Loading() {
  return (
    <main className="min-h-screen bg-surface-background flex items-center justify-center">
      <div
        className="w-40 h-40 rounded-full border-4 border-border-line border-t-brand-andaman animate-spin"
        role="status"
        aria-label="Loading"
      />
    </main>
  );
}
