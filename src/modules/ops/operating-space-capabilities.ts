import type { OperatingSpaceCapability } from './operating-space-capability-policy';

// Only these daily manual-operation capabilities have reviewed runtime guards in this slice.
export const GOVERNED_DAILY_CAPABILITIES: readonly string[] = [
  'manage_tasks', 'assign_tasks', 'manage_housekeeping', 'manage_maintenance',
];

export const CAPABILITY_DEPARTMENTS: Record<OperatingSpaceCapability, readonly string[]> = {
  view_calendar: ['reservations', 'front_desk', 'housekeeping', 'maintenance', 'guest_care', 'pricing'],
  manage_reservations: ['reservations', 'front_desk'],
  manage_tasks: ['housekeeping', 'maintenance', 'front_desk', 'guest_care', 'reservations'],
  assign_tasks: ['housekeeping', 'maintenance', 'front_desk', 'guest_care', 'reservations'],
  manage_housekeeping: ['housekeeping'], manage_maintenance: ['maintenance'],
  manage_pricing: ['pricing'], manage_availability: ['pricing', 'reservations'],
  view_finance: ['finance'], record_expense: ['finance'], generate_owner_report: ['finance'],
  manage_team: ['front_desk'], manage_channels: ['channels'],
  // Creation uses its dedicated current-authority resolver, never a department shortcut.
  create_unit: [], create_complex: [],
};
