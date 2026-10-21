import { OPERATING_CREATION_CAPABILITIES } from './operating-creation-capabilities';

export const OPERATING_SPACE_CAPABILITIES = [
  'view_calendar',
  'manage_reservations',
  'manage_tasks',
  'assign_tasks',
  'manage_housekeeping',
  'manage_maintenance',
  'manage_pricing',
  'manage_availability',
  'view_finance',
  'record_expense',
  'generate_owner_report',
  'manage_team',
  'manage_channels',
  ...OPERATING_CREATION_CAPABILITIES,
] as const;

export type OperatingSpaceCapability = typeof OPERATING_SPACE_CAPABILITIES[number];
