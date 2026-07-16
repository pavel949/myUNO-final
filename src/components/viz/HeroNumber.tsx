/**
 * HeroNumber — the one figure a section leads with (doc 06 dataviz: a
 * headline number is a stat, not a chart). Server-renderable.
 */
export default function HeroNumber({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  /** Optional trailing adornment, e.g. a DeltaChip. */
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-kicker uppercase text-text-secondary mb-4">{label}</p>
      <div className="flex items-baseline gap-12 flex-wrap">
        <span className="text-heading-1 font-bold text-text-ink">{value}</span>
        {children}
      </div>
    </div>
  );
}
