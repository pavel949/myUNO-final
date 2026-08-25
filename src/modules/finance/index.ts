// module: finance — public interface (see docs/14_tech_spec.md §3, 16_build_plan.md)
// Owns: Payment, Ledger, Statement, Refund, payment seams
// Used by: booking, services, core

export {
  recordCashPayment,
  recordCashRefund,
  createCheckout,
  verifyAndConfirm,
  refund,
  markPaymentFailed,
  type RecordCashPaymentInput,
  type RecordCashRefundInput,
  type CreateCheckoutInput,
  type CheckoutSession,
} from './finance.service';

export {
  recordCost,
  recordBookingRevenue,
  recordRefundOut,
  recordServiceCommission,
  reverseLedgerEntry,
  getUnitLedgerEntries,
  getProjectLedgerEntries,
  getLedgerEntry,
  computeUnitLedgerTotals,
  type RecordCostInput,
  type LedgerEntryWithRelations,
} from './ledger.service';

export {
  generateOwnerStatement,
  publishStatement,
  getStatement,
  listStatements,
  listDraftStatements,
  getLatestPublishedStatement,
  type StatementGenerationInput,
  type OwnerStatementData,
} from './statement.service';

export {
  getStatementSignOffState,
  hasSignedOff,
  recordStatementSignOff,
  isOwnerVisibleStatementStatus,
  isSignableStatementStatus,
  OWNER_VISIBLE_STATEMENT_STATUSES,
  SIGNABLE_STATEMENT_STATUSES,
  StatementSignOffError,
  type StatementSignOffFailure,
  type StatementSignOffActor,
  type StatementSignOffState,
  type StatementSignOffView,
} from './statement-signoff.service';

export {
  recordOwnerPayout,
  recordProviderRemittance,
  computeProviderRemittance,
  getReconciliationData,
  reconcilePayout,
  resolveFailedRefund,
  type RecordOwnerPayoutInput,
  type ProviderRemittanceInput,
  type RemittanceReport,
} from './payout.service';

export {
  scheduleDepositPreauth,
  voidDepositPreauthIfClean,
  captureDepositPreauthOnClaim,
  releaseDepositPreauthOnDispute,
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getClaimsAwaitingResolution,
  getStaysOpenToClaim,
  type DepositClaimInput,
  type DepositClaimDetails,
  type ClaimableStay,
} from './deposits.service';

// Paying by transfer into the company account. The honest sibling of cash:
// money moves outside the system, a named person confirms it, the ledger
// records it — nothing here pretends to authorise or capture.
export {
  getTransferInstructions,
  recordBankTransfer,
  transferReference,
  type TransferInstructions,
  type RecordBankTransferInput,
} from './bank-transfer.service';
