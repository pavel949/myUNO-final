import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { evaluateLayantaraCutover, REQUIREMENTS } from './layantara-cutover-gate.mjs';

const complete = () => ({
  gates: Object.fromEntries(REQUIREMENTS.map(key => [key, true])),
  sourceSnapshotUtc: '2026-09-30T00:00:00Z',
  targetSnapshotUtc: '2026-09-30T00:00:00Z',
  sourceBackupRef: 'source-backup-record',
  targetBackupRef: 'target-backup-record',
  restoreEvidenceRef: 'restore-run',
  approvedBy: 'authorized operator',
  approvedAtUtc: '2026-09-30T00:00:00Z',
  approvalRecordRef: 'signed-approval',
  releaseCommit: 'a'.repeat(40),
  occupancy: { sourceActive: 84, targetProtective: 84, missing: 0, extra: 0, unitMismatch: 0, dateMismatch: 0, reasonMismatch: 0 },
  inventory: { mappedUnits: 39, categories: 8, verifiedSpecifications: 39 },
  tariffs: { mappedSourceRateIds: 72 },
  payment: { unresolvedMismatch: 0 },
  ota: { pushEnabled: false },
});

test('absent evidence never permits switching writers', () => {
  assert.equal(evaluateLayantaraCutover(null, 'a'.repeat(40)).go, false);
});
test('complete shaped evidence requires the exact commit', () => {
  assert.equal(evaluateLayantaraCutover(complete(), 'a'.repeat(40)).go, true);
  assert.equal(evaluateLayantaraCutover(complete(), 'b'.repeat(40)).go, false);
});
test('one pending villa or missing proof prevents activation', () => {
  const e = complete();
  e.inventory.verifiedSpecifications = 8;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, false);
  e.inventory.verifiedSpecifications = 39;
  e.gates.taxAndBookingTermsApproved = false;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, false);
});
test('a mismatched source night or missing target protection prevents activation', () => {
  const e = complete();
  e.occupancy.dateMismatch = 1;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, false);
  e.occupancy.dateMismatch = 0;
  e.occupancy.targetProtective = 83;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, false);
});
test('OTA sales require provider acknowledgement', () => {
  const e = complete();
  e.ota.pushEnabled = true;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, false);
  e.ota.providerAcknowledged = true;
  assert.equal(evaluateLayantaraCutover(e, e.releaseCommit).go, true);
});
