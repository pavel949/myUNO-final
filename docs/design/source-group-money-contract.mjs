/** Review-only executable design contract. No persistence, import or payment writer. */
export function validateSourceGroupMoney(group) {
  const safeMoney = value => Number.isSafeInteger(value) && value >= 0;
  if (!group || !group.sourceKey || group.currency !== 'THB' || !safeMoney(group.quotedTotalSatang) ||
      !group.sourceDigest || !Array.isArray(group.placements) || group.placements.length < 2)
    throw new Error('SOURCE_GROUP_IDENTITY_OR_EVIDENCE_REQUIRED');
  const unitIds = new Set();
  for (const placement of group.placements) {
    if (!placement.unitId || unitIds.has(placement.unitId) || !placement.startDate ||
        !placement.endDate || placement.startDate >= placement.endDate)
      throw new Error('SOURCE_GROUP_PLACEMENT_INVALID');
    unitIds.add(placement.unitId);
  }
  if (group.allocationStatus === 'unallocated') {
    if (group.placements.some(p => p.allocatedTotalSatang !== null || p.collectibleBalanceSatang !== null))
      throw new Error('UNALLOCATED_IS_UNKNOWN_NOT_ZERO');
    if (group.receivableStatus !== 'pending_reconciliation')
      throw new Error('SOURCE_GROUP_COLLECTION_NOT_AUTHORIZED');
  } else if (group.allocationStatus === 'allocated') {
    if (!group.allocationEvidence || group.placements.some(p => !safeMoney(p.allocatedTotalSatang)) ||
        group.placements.reduce((sum, p) => sum + p.allocatedTotalSatang, 0) !== group.quotedTotalSatang)
      throw new Error('SOURCE_GROUP_ALLOCATION_EVIDENCE_OR_PARITY_REQUIRED');
    // Allocation is not payment reconciliation or permission to collect.
    if (group.receivableStatus !== 'pending_reconciliation')
      throw new Error('SEPARATE_RECEIVABLE_REVIEW_REQUIRED');
  } else throw new Error('SOURCE_GROUP_ALLOCATION_STATUS_REQUIRED');
  return Object.freeze({ calendarPlacements: group.placements.length,
    quotedTotalSatang: group.quotedTotalSatang,
    unknownAllocationCount: group.allocationStatus === 'unallocated' ? group.placements.length : 0,
    canCollect: false, canSettle: false, canRecognizeOwnerRevenue: false });
}
