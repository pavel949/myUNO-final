import Link from 'next/link';
import type { UnitIcalConflictAlert } from '@/modules/integrations/unit-ical-conflicts';

function fill(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

const CALENDAR_PATH_BY_SURFACE = {
  ops: '/ops/calendar',
  mc: '/mc/units',
  none: null,
} as const;

export type UnitIcalCalendarSurface = keyof typeof CALENDAR_PATH_BY_SURFACE;

export const UNIT_ICAL_CALENDAR_SURFACES = {
  ops: 'ops',
  mc: 'mc',
  none: 'none',
} as const satisfies Record<UnitIcalCalendarSurface, UnitIcalCalendarSurface>;

export default function UnitIcalConflictBanner({
  conflicts,
  labels,
  calendarSurface = 'ops',
}: {
  conflicts: UnitIcalConflictAlert[];
  labels: Record<string, string>;
  /** Which portal calendar each conflict row should link to. */
  calendarSurface?: UnitIcalCalendarSurface;
}) {
  const calendarPathPrefix = CALENDAR_PATH_BY_SURFACE[calendarSurface];
  if (conflicts.length === 0) {
    return null;
  }

  const titleKey = labels['staff.ops.ical_conflicts_title']
    ? 'staff.ops.ical_conflicts_title'
    : 'staff.calendar.conflict_title';
  const hintKey = labels['staff.ops.ical_conflicts_hint']
    ? 'staff.ops.ical_conflicts_hint'
    : 'staff.calendar.conflict_hint';
  const bodyKey = labels['staff.calendar.conflict_body_with_unit']
    ? 'staff.calendar.conflict_body_with_unit'
    : 'staff.calendar.conflict_body';

  return (
    <section className="mb-24 bg-state-warning-soft border border-state-warning rounded-lg p-20">
      <h2 className="text-heading-3 font-semibold text-state-warning mb-8">
        {labels[titleKey]}
      </h2>
      <p className="text-small text-text-secondary mb-12">{labels[hintKey]}</p>
      <ul className="space-y-12">
        {conflicts.map((conflict) => {
          const text = fill(labels[bodyKey] || bodyKey, {
            unit_name: conflict.unitName,
            guest_name: conflict.guestName,
            start_date: conflict.startDate,
            end_date: conflict.endDate,
          });
          const calendarHref = calendarPathPrefix
            ? `${calendarPathPrefix}/${conflict.unitId}`
            : null;
          return (
            <li
              key={conflict.bookingId}
              className="text-body text-text-ink border-b border-state-warning/30 last:border-b-0 pb-12 last:pb-0"
            >
              {calendarHref ? (
                <Link href={calendarHref} className="font-semibold text-brand-andaman hover:underline">
                  {text}
                </Link>
              ) : (
                text
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
