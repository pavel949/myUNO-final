// module: finance — public interface (see docs/14_tech_spec.md §3, 16_build_plan.md)
// Owns: Payment, Ledger, Statement, Refund, payment seams
// Used by: booking, services, core

export {
  recordCashPayment,
  recordCashRefund,
  createCheckout,
  CheckoutStateError,
  verifyAndConfirm,
  refund,
  markRefundFailed,
  markRefundSucceeded,
  getBookingRefundDisplayState,
  markPaymentFailed,
  type BookingRefundDisplayState,
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
  reverseManualCost,
  lockUnitLedgerShared,
  lockUnitLedgerExclusive,
  LedgerCorrectionError,
  getUnitLedgerEntries,
  getProjectLedgerEntries,
  getLedgerEntry,
  computeUnitLedgerTotals,
  type RecordCostInput,
  type LedgerEntryWithRelations,
  type LedgerCorrectionCode,
  type ManualCostReversal,
} from './ledger.service';

export {
  MANUAL_COST_TYPES,
  ManualCostInputError,
  parseManualCostRequest,
  manualCostFingerprint,
  isIdempotencyKey,
  type ManualCostRequest,
  type ManualCostType,
  type ManualCostErrorCode,
} from './manual-cost-input';

export {
  recordManualCost,
  reportImpactFor,
  ManualCostError,
  type ManualCostView,
  type RecordManualCostResult,
  type ReportImpact,
} from './manual-cost.service';

export { canWriteUnitExpenses, resolveReceiptReader, type ReceiptReader } from './expense-access';

export {
  attachExpenseReceipt,
  readExpenseReceipt,
  ReceiptError,
  type AttachReceiptResult,
  type ReceiptDownload,
  type ReceiptView,
} from './expense-receipt.service';

export {
  MAX_RECEIPT_BYTES,
  RECEIPT_MIME_TYPES,
  ReceiptFileError,
  ReceiptIntegrityError,
} from './expense-receipt-file';

export {
  OPERATING_EXPENSE_ENTRY_TYPES,
  buildLedgerLines,
  sumByType,
  sumOperatingExpenses,
} from './statement-expense';

export {
  REVENUE_BOOKING_STATUSES,
  collectSnapshotSources,
  dayAfter,
  snapshotHash,
  sourceFingerprint,
  verifyStatementSnapshot,
} from './statement-snapshot';

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
  computeProviderRemittance,
  getProviderRemittancesView,
  resolveProviderPayoutPeriod,
  type PayoutPeriodCadence,
  type ProviderRemittancePayoutRow,
  type ProviderRemittancesView,
  type RemittanceReport,
} from './remittance.service';

export {
  getReconciliationData,
  reconcilePayout,
  resolveFailedRefund,
} from './payout.service';

export {
  scheduleDepositPreauth,
  scheduleDepositPreauthIfConfigured,
  ensureDepositPreauthOnStayConfirmed,
  voidDepositPreauthIfClean,
  releaseExpiredDepositPreauths,
  captureDepositPreauthOnClaim,
  releaseDepositPreauthOnDispute,
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getClaimsAwaitingResolution,
  getStaysOpenToClaim,
  getActiveDepositClaimForGuest,
  disputeDepositClaim,
  type DepositClaimInput,
  type DepositClaimDetails,
  type DepositClaimGuestView,
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

export { processOpnEvent, type OpnWebhookEvent } from './provider-webhook.service';

export { getPaymentProvider } from './providers';
