import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const payouts = await prisma.payout.findMany({
    include: {
      recordedBy: { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
      ownerStatement: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const labels = await getLabels({
    'admin.payouts.title': 'Payouts',
    'admin.payouts.empty': 'No payouts recorded.',
    'admin.payouts.reference': 'Reference',
    'admin.payouts.amount': 'Amount (฿)',
    'admin.payouts.status': 'Status',
    'admin.payouts.recorded_by': 'Recorded By',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.payouts.title']}
      </h1>
      {payouts.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.payouts.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.payouts.reference']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.payouts.amount']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.payouts.status']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.payouts.recorded_by']}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-border-line">
                  <td className="px-12 py-8 font-mono">{p.reference}</td>
                  <td className="px-12 py-8 text-right font-mono">{(p.amountThb / 100).toFixed(2)}</td>
                  <td className="px-12 py-8">{p.status}</td>
                  <td className="px-12 py-8">
                    {`${p.recordedBy?.firstName} ${p.recordedBy?.lastName}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
