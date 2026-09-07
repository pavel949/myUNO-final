import { getLabels } from '@/lib/i18n';
import ReconciliationClient from './reconciliation-client';

export const dynamic = 'force-dynamic';

/**
 * Reconciliation board (doc 10 §9, T-031). Auth is enforced by the API route
 * (`GET /api/admin/finance/reconciliation`, admin-only); this page fetches
 * its content-layer labels server-side and hands them to the client board.
 */
export default async function ReconciliationPage() {
  const labels = await getLabels({
    'finance.reconciliation.title': 'Reconciliation Board',
    'finance.reconciliation.description':
      'Manage unmatched payments, failed refunds, and pending payouts.',
    'finance.reconciliation.loading': 'Loading...',
    'finance.reconciliation.error_title': 'Error',
    'finance.reconciliation.no_data': 'No reconciliation data available.',
    'finance.reconciliation.unmatched_payments': 'Unmatched Payments',
    'finance.reconciliation.failed_refunds': 'Failed Refunds',
    'finance.reconciliation.pending_payouts': 'Pending Payouts',
    'finance.reconciliation.col_amount': 'Amount',
    'finance.reconciliation.col_method': 'Method',
    'finance.reconciliation.col_purpose': 'Purpose',
    'finance.reconciliation.col_payer': 'Payer',
    'finance.reconciliation.col_status': 'Status',
    'finance.reconciliation.col_created': 'Created',
    'finance.reconciliation.col_type': 'Type',
    'finance.reconciliation.col_reference': 'Reference',
    'finance.reconciliation.col_executed': 'Executed',
    'finance.reconciliation.col_recorded_by': 'Recorded By',
    'finance.reconciliation.col_action': 'Action',
    'finance.reconciliation.refund_amount': 'Refund Amount',
    'finance.reconciliation.reason': 'Reason',
    'finance.reconciliation.initiated_by': 'Initiated By',
    'finance.reconciliation.retry_refund': 'Retry',
    'finance.reconciliation.write_off': 'Write Off',
    'finance.reconciliation.mark_reconciled': 'Mark Reconciled',
    'finance.reconciliation.all_clear': 'All Clear',
    'finance.reconciliation.no_issues':
      'No unmatched payments, failed refunds, or pending payouts.',
  });

  return <ReconciliationClient labels={labels} />;
}
