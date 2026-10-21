import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceGroupMoney } from './source-group-money-contract.mjs';
const group = () => ({ sourceKey: 'synthetic-sheet:synthetic-booking', sourceDigest: 'synthetic-review-digest',
  currency: 'THB', quotedTotalSatang: 300001, allocationStatus: 'unallocated', receivableStatus: 'pending_reconciliation',
  sourcePaymentEvidence: { rawStatus: 'Paid', reportedPaidSatang: 300001 },
  placements: ['unit-one', 'unit-two', 'unit-three'].map(unitId => ({ unitId, startDate: '2026-12-17', endDate: '2026-12-21',
    allocatedTotalSatang: null, collectibleBalanceSatang: null })) });

test('one exact group quote and three placements preserve unknown money without collection', () => {
  const input = group(), before = JSON.stringify(input), result = validateSourceGroupMoney(input);
  assert.equal(result.quotedTotalSatang, 300001); assert.equal(result.unknownAllocationCount, 3);
  assert.equal(result.calendarPlacements, 3); assert.equal(result.canCollect, false);
  assert.equal(result.canSettle, false); assert.equal(result.canRecognizeOwnerRevenue, false);
  assert.equal(JSON.stringify(input), before);
});
for (const amount of [0, 100000, 300001]) test(`unallocated child amount ${amount} is rejected rather than fabricated`, () => {
  const input = group(); input.placements[0].allocatedTotalSatang = amount;
  assert.throws(() => validateSourceGroupMoney(input), /UNALLOCATED_IS_UNKNOWN_NOT_ZERO/);
});
test('unallocated zero balance is also an invented collectible fact', () => {
  const input = group(); input.placements[0].collectibleBalanceSatang = 0;
  assert.throws(() => validateSourceGroupMoney(input), /UNALLOCATED_IS_UNKNOWN_NOT_ZERO/);
});
test('source Paid label cannot make the group collectible', () => {
  const input = group(); input.receivableStatus = 'collectible';
  assert.throws(() => validateSourceGroupMoney(input), /COLLECTION_NOT_AUTHORIZED/);
});
test('explicit source allocation must preserve the exact group sum and separate receivable review', () => {
  const input = group(); input.allocationStatus = 'allocated'; input.allocationEvidence = 'synthetic-source-cell-ranges';
  [100001, 120000, 80000].forEach((amount, i) => { input.placements[i].allocatedTotalSatang = amount; });
  assert.equal(validateSourceGroupMoney(input).unknownAllocationCount, 0);
  input.placements[0].allocatedTotalSatang++;
  assert.throws(() => validateSourceGroupMoney(input), /PARITY_REQUIRED/);
});
test('matching totals alone are not source allocation evidence', () => {
  const input = group(); input.allocationStatus = 'allocated';
  [100001, 100000, 100000].forEach((amount, i) => { input.placements[i].allocatedTotalSatang = amount; });
  assert.throws(() => validateSourceGroupMoney(input), /EVIDENCE_OR_PARITY_REQUIRED/);
});
test('physical villa identity cannot appear twice in one simultaneous group', () => {
  const input = group(); input.placements[1].unitId = input.placements[0].unitId;
  assert.throws(() => validateSourceGroupMoney(input), /PLACEMENT_INVALID/);
});
