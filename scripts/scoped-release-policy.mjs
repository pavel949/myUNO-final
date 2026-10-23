import assert from 'node:assert/strict';
export const RELEASE_SHA = 'be5843c04f4d36e5edb00bd49984df1473869df0';
export const RELEASE_MIGRATIONS = [
  '20261021010000_booking_refund_dispatch_authorization',
  '20261021023000_imported_reservation_groups',
  '20261021140000_sales_offer_desk',
];
export function assertScopedRelease({ releaseHead, controlHead, eventSha, ref, backupSha, mode, migrationNames }) {
  assert.equal(ref, 'refs/heads/main', 'Release control must run from main');
  assert.match(eventSha ?? '', /^[a-f0-9]{40}$/);
  assert.equal(controlHead, eventSha, 'Control checkout must match the actual workflow SHA');
  assert.equal(releaseHead, RELEASE_SHA, 'Application checkout must match the approved ancestor');
  assert.ok(['preflight', 'migrate'].includes(mode), 'Unknown release stage');
  if (mode === 'migrate') assert.equal(backupSha, RELEASE_SHA, 'Exact release backup/restore attestation required');
  assert.deepEqual(migrationNames.filter(name => name.startsWith('20261021')).sort(), RELEASE_MIGRATIONS);
}
