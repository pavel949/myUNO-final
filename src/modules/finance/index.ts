// module: finance — public interface (see docs/14_tech_spec.md §3)
// Owns: Payment, Ledger, Statement, Refund, payment seams
// Used by: booking, services

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
