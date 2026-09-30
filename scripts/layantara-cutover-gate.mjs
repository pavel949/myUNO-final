#!/usr/bin/env node
/**
 * Layantara cutover gate. Read-only decision helper: it NEVER changes either DB,
 * application flags, inventory status, payment provider or OTA state.
 * A signed evidence manifest is required. Without it the result is NO-GO.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIREMENTS = Object.freeze([
  'exactHeadCiGreen',
  'targetMigrationsAndDriftGreen',
  'sourceAndTargetBackupRestored',
  'physicalUnits39Verified',
  'categories8Verified',
  'unitSpecifications39Approved',
  'tariffIdentities72Verified',
  'tariffGoldenMasterApproved',
  'taxAndBookingTermsApproved',
  'mediaSourceIndependentOrDependencyAccepted',
  'currentOccupancyRowwiseExact',
  'finalSourceDeltaReconciled',
  'historicalFinanceDispositionAccepted',
  'paymentAndRefundSmokePassed',
  'roleAndCalendarBrowserSmokePassed',
  'sourceBookingWritersFrozen',
  'singleWriterSwitchPlanApproved',
  'rollbackAndReplayTested',
  'deploymentShaVerified',
]);

export function evaluateLayantaraCutover(evidence, currentHead) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    return { go: false, missing: ['signed evidence manifest'] };
  const missing = REQUIREMENTS.filter(key => evidence.gates?.[key] !== true);
  if (!evidence.sourceSnapshotUtc || !evidence.targetSnapshotUtc ||
      !evidence.sourceBackupRef || !evidence.targetBackupRef ||
      !evidence.restoreEvidenceRef || !evidence.approvedBy ||
      !evidence.approvedAtUtc || !evidence.approvalRecordRef)
    missing.push('immutable backup/snapshot/approval references');
  if (!currentHead || evidence.releaseCommit !== currentHead)
    missing.push('exact release SHA evidence');
  if (evidence.occupancy?.missing !== 0 || evidence.occupancy?.extra !== 0 ||
      evidence.occupancy?.unitMismatch !== 0 || evidence.occupancy?.dateMismatch !== 0 ||
      evidence.occupancy?.reasonMismatch !== 0 || !(evidence.occupancy?.sourceActive > 0) ||
      evidence.occupancy?.sourceActive !== evidence.occupancy?.targetProtective)
    missing.push('fresh rowwise occupancy equality');
  if (evidence.inventory?.mappedUnits !== 39 || evidence.inventory?.categories !== 8 ||
      evidence.inventory?.verifiedSpecifications !== 39 ||
      evidence.tariffs?.mappedSourceRateIds !== 72)
    missing.push('verified physical inventory and tariff identity');
  if (evidence.payment?.unresolvedMismatch !== 0 || evidence.ota?.pushEnabled === true &&
      evidence.ota?.providerAcknowledged !== true)
    missing.push('money reconciliation or OTA acknowledgement');
  return { go: missing.length === 0, missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [manifestPath, currentHead] = process.argv.slice(2);
  if (!manifestPath || !currentHead) {
    console.error('NO-GO: Usage: node scripts/layantara-cutover-gate.mjs <signed-evidence.json> <exact-deploy-sha>');
    process.exit(2);
  }
  try {
    const evidence = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const result = evaluateLayantaraCutover(evidence, currentHead);
    console.log(result.go ? 'GO: recorded evidence requirements satisfied; operational switch still requires controlled execution.' : 'NO-GO: ' + result.missing.join('; '));
    process.exit(result.go ? 0 : 1);
  } catch {
    console.error('NO-GO: evidence manifest cannot be read or parsed.');
    process.exit(1);
  }
}
