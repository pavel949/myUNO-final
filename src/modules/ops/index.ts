// module: ops — public interface (see docs/07_flows.md §F-OPS)
// Owns: Tm30Filing, ConditionReport, ComplianceRecord, verification
// Depends on: core, config, comms

export {
  createTm30Filing,
  markTm30FilingFiled,
  markTm30FilingFailed,
  getTm30Queue,
  logTm30PassportAccess,
  checkTm30Escalations,
  createConditionReport,
  getConditionReport,
  type CreateTm30FilingInput,
  type Tm30FilingDetails,
  type CreateConditionReportInput,
} from './tm30-filing.service';

export {
  capturePassportData,
  markVerificationFailed,
  decryptPassportNumber,
  checkVerificationDeadlines,
  type CapturePassportDataInput,
  type VerificationCheckResult,
} from './verification.service';

export { getOpsBoard, getOpsMobilizationQueue, getOpsBookingRequests } from './ops-board.service';
export type { OpsMobilizationUnit, OpsBookingRequest } from './ops-board.service';
export type { OpsBoardData } from './ops-board.service';

export {
  encryptGuestPii,
  encryptPii,
  safeDecrypt,
  isEncrypted,
  type GuestPiiInput,
} from './guest-pii';

export {
  buildTm30AddressBlock,
  TM30_IMMIGRATION_PORTAL_URL,
} from './tm30-address';

export {
  CHECK_IN_CHECKLIST_ITEMS,
  formatCheckInChecklistNotes,
  type CheckInChecklistItem,
} from './check-in-checklist';

export {
  CHECK_OUT_CHECKLIST_ITEMS,
  formatCheckOutChecklistNotes,
  type CheckOutChecklistItem,
} from './check-out-checklist';

export {
  ensureTurnoverTasksForCheckout,
  assertUnitReadyForCheckIn,
  transitionOperationalTask,
  getUnitReadinessMap,
  listOperationalTasks,
  createOperationalTask,
  createPreventiveMaintenancePlan,
  generateDuePreventiveMaintenanceTasks,
  type UnitReadinessState,
  type CreateOperationalTaskInput,
  type CreatePreventiveMaintenancePlanInput,
} from './operational-task.service';


export {
  OPERATING_SPACE_CAPABILITIES,
  listOperatingSpacesForIdentity,
  getOperatingSpaceUnitIds,
  getOperatingSpaceMembership,
  hasOperatingSpaceCapability,
  hasOperatingSpaceCapabilityForUnit,
  hasAnyOperatingSpaceCapability,
  assertOperatingSpaceCapability,
  type OperatingSpaceCapability,
} from './operating-space.service';
