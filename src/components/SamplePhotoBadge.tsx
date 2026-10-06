/**
 * Marks a sample (stand-in) photo so nobody mistakes it for the real home,
 * service or project. Founder ruling 2026-10-06: samples stay visibly marked
 * until real media replaces them.
 */
export function SamplePhotoBadge({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`pointer-events-none absolute left-12 top-12 z-10 rounded-full bg-black/55 px-12 py-4 text-small font-semibold text-white backdrop-blur ${className}`}>
      {label}
    </span>
  );
}
