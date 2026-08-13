import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getPipeline } from '@/modules/crm';
import CrmPipelineClient from './pipeline-client';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  const [{ counts, opportunities }, contacts] = await Promise.all([
    getPipeline(prisma),
    prisma.identity.findMany({
      where: { status: { in: ['active', 'invited'] } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    }),
  ]);
  const labels = await getLabels({
    'admin.crm.title': 'CRM & Pipeline',
    'admin.crm.subtitle': 'One commercial memory from first inquiry through guest, buyer and owner.',
    'admin.crm.new': 'New opportunity',
    'admin.crm.contact': 'Contact',
    'admin.crm.type': 'Type',
    'admin.crm.opportunity_title': 'Opportunity title',
    'admin.crm.source': 'Source',
    'admin.crm.value': 'Value, THB',
    'admin.crm.next_action': 'Next action',
    'admin.crm.partner': 'External partner',
    'admin.crm.create': 'Create',
    'admin.crm.empty': 'No active opportunities.',
    'admin.crm.error': 'CRM action failed.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['admin.crm.title']}</h1>
      <p className="text-body text-text-secondary mb-24">{labels['admin.crm.subtitle']}</p>
      <CrmPipelineClient
        opportunities={opportunities.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          expectedCloseAt: item.expectedCloseAt?.toISOString() ?? null,
          nextActionAt: item.nextActionAt?.toISOString() ?? null,
          wonAt: item.wonAt?.toISOString() ?? null,
          lostAt: item.lostAt?.toISOString() ?? null,
        }))}
        counts={counts.map((item) => ({
          stage: item.stage,
          count: item._count._all,
          valueThb: item._sum.valueThb ?? 0,
        }))}
        contacts={contacts}
        labels={labels}
      />
    </div>
  );
}

