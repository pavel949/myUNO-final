/**
 * Enum values shown to people come from content keys (doc 05 §4: every doc 02
 * enum label lives under common.*), never from the raw value. Screens used to
 * print `booking.status.replace(/_/g, ' ')`: "checked in", "booking com",
 * "turnover cleaning" — English, lower-case, untranslatable.
 *
 * Usage: request the group's keys with getLabels (English defaults are the
 * humanized values), then render with enumLabel().
 */
export const ENUM_GROUPS = {
  bookingStatus: {
    prefix: 'common.status.booking',
    values: ['requested', 'pending_payment', 'confirmed', 'checked_in', 'checked_out', 'completed', 'declined', 'expired', 'cancelled'],
  },
  bookingChannel: {
    prefix: 'common.channel',
    values: ['direct', 'airbnb', 'booking_com', 'agoda', 'agent', 'manual', 'expedia', 'trip_com'],
  },
  taskType: {
    prefix: 'common.task_type',
    values: ['turnover_cleaning', 'turnover_inspection', 'maintenance_followup', 'preventive_maintenance', 'deep_cleaning',
      'restocking', 'guest_request', 'prearrival', 'owner_request', 'utilities', 'pool', 'garden', 'pest_control', 'compliance', 'custom'],
  },
  taskStatus: {
    prefix: 'common.status.task',
    values: ['planned', 'assigned', 'in_progress', 'inspected', 'blocked', 'ready', 'cancelled'],
  },
} as const;

export type EnumGroup = keyof typeof ENUM_GROUPS;

/** "booking_com" → "Booking com": the fallback when a key is missing. */
export function humanizeEnum(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `{ 'common.channel.direct': 'Direct', … }` — pass to getLabels. */
export function enumLabelDefaults(...groups: EnumGroup[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of groups) {
    const { prefix, values } = ENUM_GROUPS[group];
    for (const value of values) out[`${prefix}.${value}`] = humanizeEnum(value);
  }
  return out;
}

export function enumLabel(labels: Record<string, string>, group: EnumGroup, value: string | null | undefined): string {
  if (!value) return '';
  return labels[`${ENUM_GROUPS[group].prefix}.${value}`] ?? humanizeEnum(value);
}
