import { Metadata } from 'next';
import { getAdminSignals } from '@/app/actions/getAdminSignals';
import { SignalsList } from '@/app/components/admin/SignalsList';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getLabels } from '@/lib/i18n';
import { HBarStack, CHART_SEQUENTIAL } from '@/components/viz';

export const metadata: Metadata = {
  title: 'Buyer Signals',
};

export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    redirect('/login');
  }

  const isAdmin = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true },
  });

  if (!isAdmin?.isAdmin) {
    redirect('/app');
  }

  const [{ signals }, statusCounts] = await Promise.all([
    getAdminSignals(),
    prisma.buyerSignal.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const countFor = (status: string) =>
    statusCounts.find((c) => c.status === status)?._count._all ?? 0;

  const labels = await getLabels({
    'admin.signals.title': 'Buyer Signals',
    'admin.signals.subtitle': 'Monitor and manage buyer interest signals across the platform.',
    'admin.signals.all': 'All Signals',
    'admin.signals.funnel.title': 'Funnel',
    'admin.signals.funnel.count': 'Signals',
    'admin.signals.funnel.stage': 'Stage',
    'admin.signals.funnel.dismissed': 'Dismissed',
    'admin.signals.chart.show_table': 'View as table',
    'admin.signals.chart.hide_table': 'Hide table',
    'admin.signals.empty': 'No signals found',
    'admin.signals.error_update': 'Failed to update signal',
    'admin.signals.col.identity': 'Identity',
    'admin.signals.col.signal': 'Signal',
    'admin.signals.col.strength': 'Strength',
    'admin.signals.col.status': 'Status',
    'admin.signals.col.reviewed_by': 'Reviewed By',
    'admin.signals.col.actions': 'Actions',
    'admin.signals.key.repeat_stay': 'Repeat Stay',
    'admin.signals.key.long_stay': 'Long Stay',
    'admin.signals.key.listing_engagement': 'Listing Engagement',
    'admin.signals.key.purchase_question': 'Purchase Question',
    'admin.signals.key.direct_inquiry': 'Direct Inquiry',
    'admin.signals.status.open': 'Open',
    'admin.signals.status.reviewed': 'Reviewed',
    'admin.signals.status.handed_to_capital': 'Handed to Capital',
    'admin.signals.status.dismissed': 'Dismissed',
    'admin.signals.action.mark_reviewed': 'Mark Reviewed',
    'admin.signals.action.hand_to_capital': 'Hand to Capital',
    'admin.signals.action.dismiss': 'Dismiss',
    'admin.signals.strength_of': 'Strength {value} of 3',
  });

  // The buyer funnel (doc 06 S14): ordinal stages on the sequential ramp
  const funnelRows = [
    {
      label: labels['admin.signals.status.open'],
      segments: [
        {
          key: 'open',
          label: labels['admin.signals.status.open'],
          value: countFor('open'),
          color: CHART_SEQUENTIAL[2],
        },
      ],
    },
    {
      label: labels['admin.signals.status.reviewed'],
      segments: [
        {
          key: 'reviewed',
          label: labels['admin.signals.status.reviewed'],
          value: countFor('reviewed'),
          color: CHART_SEQUENTIAL[3],
        },
      ],
    },
    {
      label: labels['admin.signals.status.handed_to_capital'],
      segments: [
        {
          key: 'handed',
          label: labels['admin.signals.status.handed_to_capital'],
          value: countFor('handed_to_capital'),
          color: CHART_SEQUENTIAL[4],
        },
      ],
    },
  ];

  return (
    <div>
      <div className="mb-24">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">
          {labels['admin.signals.title']}
        </h1>
        <p className="text-body text-text-secondary">{labels['admin.signals.subtitle']}</p>
      </div>

      <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.signals.funnel.title']}
        </h2>
        <HBarStack
          rows={funnelRows}
          valueHeader={labels['admin.signals.funnel.count']}
          labelHeader={labels['admin.signals.funnel.stage']}
          tableToggleLabels={{
            show: labels['admin.signals.chart.show_table'],
            hide: labels['admin.signals.chart.hide_table'],
          }}
          emptyLabel={labels['admin.signals.empty']}
        />
        {countFor('dismissed') > 0 ? (
          <p className="text-small text-text-secondary mt-12">
            {labels['admin.signals.funnel.dismissed']}: {countFor('dismissed')}
          </p>
        ) : null}
      </div>

      <div className="bg-surface-paper border border-border-line rounded-lg">
        <div className="px-24 py-16 border-b border-border-line">
          <h2 className="text-heading-3 font-semibold text-text-ink">
            {labels['admin.signals.all']} ({signals.length})
          </h2>
        </div>
        <div className="p-24">
          <SignalsList signals={signals} labels={labels} />
        </div>
      </div>
    </div>
  );
}
