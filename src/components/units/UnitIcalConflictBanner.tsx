import type { UnitIcalConflictAlert } from '@/modules/integrations/unit-ical-conflicts';

function fill(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export default function UnitIcalConflictBanner({
  conflicts,
  labels,
}: {
  conflicts: UnitIcalConflictAlert[];
  labels: Record<string, string>;
}) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section className="mb-24 bg-state-warning-soft border border-state-warning rounded-lg p-20">
      <h2 className="text-heading-3 font-semibold text-state-warning mb-8">
        {labels['staff.calendar.conflict_title']}
      </h2>
      <p className="text-small text-text-secondary mb-12">
        {labels['staff.calendar.conflict_hint']}
      </p>
      <ul className="space-y-12">
        {conflicts.map((conflict) => (
          <li
            key={conflict.bookingId}
            className="text-body text-text-ink border-b border-state-warning/30 last:border-b-0 pb-12 last:pb-0"
          >
            {fill(labels['staff.calendar.conflict_body'], {
              guest_name: conflict.guestName,
              start_date: conflict.startDate,
              end_date: conflict.endDate,
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
