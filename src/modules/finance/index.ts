// module: finance — public interface (see docs/14_tech_spec.md §3, 16_build_plan.md)
// Owns: Payment, Ledger, Statement, Refund, payment seams
// Used by: booking, services, core

export {
  recordCashPayment,
  recordCashRefund,
  createCheckout,
  verifyAndConfirm,
  refund,
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
  recordOwnerPayout,
  recordProviderRemittance,
  computeProviderRemittance,
  getFailedRefunds,
  markPayoutReconciled,
  getUnreconciledPayouts,
  type RecordOwnerPayoutInput,
  type ProviderRemittanceInput,
  type RemittanceReport,
} from './payout.service';

export {
  createPreAuthDeposit,
  voidDepositOnCleanCheckout,
  captureDepositOnClaim,
  releaseDepositOnDisputeResolution,
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getClaimsAwaitingResolution,
  type DepositClaimInput,
  type DepositClaimDetails,
} from './deposits.service';
