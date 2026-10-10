import { publicSleepingSpaces, type PublicSleepingSpace } from '@/modules/projects/public-sleeping';

/** Rendered on the server for both inquiry-only and bookable public details. */
export function PublicSleepingSummary({ spaces, labels }: {
  spaces?: PublicSleepingSpace[]; labels: Record<string, string>;
}) {
  const visible = publicSleepingSpaces(spaces);
  if (!visible.length) return null;
  return (
    <section aria-label={labels['listing.sleeping.title']} className="my-24">
      <h2 className="mb-16 font-display text-heading-3 font-semibold text-text-ink">{labels['listing.sleeping.title']}</h2>
      <ol className="grid gap-12 sm:grid-cols-2">
        {visible.map((space, index) => (
          <li key={`${space.sortOrder}-${index}`} className="rounded-lg border border-border-line bg-surface-paper p-16">
            <h3 className="mb-8 font-semibold text-text-ink">{labels[`listing.sleeping.${space.spaceType}`]} {index + 1}</h3>
            <ul className="space-y-4 text-small text-text-secondary">
              {space.beds.map((bed, bedIndex) => <li key={`${bed.bedType}-${bedIndex}`}>{bed.count} × {labels[`listing.sleeping.${bed.bedType}`]}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
