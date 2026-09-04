import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import ProviderRemittancesClient from './remittances-client';

export const dynamic = 'force-dynamic';

/** S13 / F-PROV-4: provider remittance report and payout history. */
export default async function ProviderRemittancesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider/remittances');
  }

  const providerId = user.roles.find(
    (r) => r.role === 'provider_member' && r.providerId
  )?.providerId;
  if (!providerId) {
    redirect('/provider');
  }

  const labels = await getLabels({
    'provider.remittances.title': 'Remittances',
    'provider.remittances.loading': 'Loading remittance report…',
    'provider.remittances.error_generic': 'Could not load remittance data. Please try again.',
    'provider.remittances.current_period': 'Current period',
    'provider.remittances.cadence_weekly': 'Paid weekly',
    'provider.remittances.cadence_biweekly': 'Paid every two weeks',
    'provider.remittances.cadence_monthly': 'Paid monthly',
    'provider.remittances.gross': 'Fulfilled orders total',
    'provider.remittances.take_rate': 'myUNO take rate',
    'provider.remittances.refunds': 'Refunds clawed back',
    'provider.remittances.net': 'Net remittance',
    'provider.remittances.order_count': '{count} fulfilled orders in this period',
    'provider.remittances.refund_count': '{count} refunds clawed back',
    'provider.remittances.payout_recorded': 'Payout recorded',
    'provider.remittances.payout_pending': 'Payout pending',
    'provider.remittances.history_title': 'Payout history',
    'provider.remittances.history_empty':
      'No payouts recorded yet — they appear here once myUNO executes your remittance.',
    'provider.remittances.period': 'Period',
    'provider.remittances.amount': 'Amount',
    'provider.remittances.reference': 'Reference',
    'provider.remittances.executed_on': 'Paid on',
    'provider.remittances.status': 'Status',
    'provider.remittances.status_recorded': 'Recorded',
    'provider.remittances.status_reconciled': 'Reconciled',
  });

  return (
    <div>
      <h2 className="text-heading-3 font-bold text-text-ink mb-24">
        {labels['provider.remittances.title']}
      </h2>
      <ProviderRemittancesClient labels={labels} />
    </div>
  );
}
