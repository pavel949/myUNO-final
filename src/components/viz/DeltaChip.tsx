/**
 * DeltaChip — the doc 06 §3.2 StatTile delta: change vs the previous period.
 * Direction is carried by the arrow icon AND the color (never color alone).
 * Server-renderable.
 */
export default function DeltaChip({
  currentValue,
  previousValue,
  vsLabel,
  newLabel,
}: {
  currentValue: number;
  previousValue: number | null;
  /** e.g. "vs last month" — from the content layer. */
  vsLabel: string;
  /** Shown when there is no previous period to compare against. */
  newLabel: string;
}) {
  if (previousValue === null || previousValue === 0) {
    if (previousValue === 0 && currentValue === 0) return null;
    return (
      <span className="inline-flex items-center gap-4 px-8 py-2 rounded-full bg-surface-ivory text-text-stone text-small font-semibold">
        {newLabel}
      </span>
    );
  }

  const pct = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-4 px-8 py-2 rounded-full bg-surface-ivory text-text-stone text-small font-semibold">
        <span aria-hidden>→</span> 0% <span className="font-normal">{vsLabel}</span>
      </span>
    );
  }

  const up = rounded > 0;
  return (
    <span
      className={`inline-flex items-center gap-4 px-8 py-2 rounded-full text-small font-semibold ${
        up
          ? 'bg-state-success-soft text-state-success'
          : 'bg-state-error-soft text-state-error'
      }`}
    >
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      {up ? '+' : ''}
      {rounded}% <span className="font-normal">{vsLabel}</span>
    </span>
  );
}
