import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listProjects } from '@/modules/projects';

export const dynamic = 'force-dynamic';

export default async function AdminStatementsPage() {
  const projects = await listProjects();
  const statements = await prisma.statement.findMany({
    include: {
      unitEngagement: {
        include: {
          owner: { select: { firstName: true, lastName: true } },
          unit: { select: { name: true } },
        },
      },
    },
    orderBy: { periodEnd: 'desc' },
    take: 50,
  });

  const labels = await getLabels({
    'admin.statements.title': 'Monthly Statements',
    'admin.statements.empty': 'No statements yet.',
    'admin.statements.period': 'Period',
    'admin.statements.owner': 'Owner',
    'admin.statements.unit': 'Unit',
    'admin.statements.net': 'Net (฿)',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.statements.title']}
      </h1>
      {statements.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.statements.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.statements.period']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.owner']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.unit']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.statements.net']}</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-b border-border-line">
                  <td className="px-12 py-8">
                    {`${s.periodStart.toLocaleDateString()} – ${s.periodEnd.toLocaleDateString()}`}
                  </td>
                  <td className="px-12 py-8">
                    {`${s.unitEngagement?.owner?.firstName} ${s.unitEngagement?.owner?.lastName}`}
                  </td>
                  <td className="px-12 py-8">{s.unitEngagement?.unit?.name || '—'}</td>
                  <td className="px-12 py-8 text-right font-mono">{(s.netThb / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
