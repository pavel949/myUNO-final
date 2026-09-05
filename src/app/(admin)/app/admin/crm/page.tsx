import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getPipeline } from '@/modules/crm';
import CrmPipelineClient from './pipeline-client';
import CrmDashboardPanel from './crm-dashboard-panel';
import CrmLifecyclePanel from './crm-lifecycle-panel';

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
    'admin.crm.pipeline_breakdown': 'Pipeline breakdown',
    'admin.crm.next_action_overdue': 'Next action overdue',
    'admin.crm.lost_reason': 'Reason for loss',
    'admin.crm.stage.new': 'New',
    'admin.crm.stage.qualified': 'Qualified',
    'admin.crm.stage.discovery': 'Discovery',
    'admin.crm.stage.proposal': 'Proposal',
    'admin.crm.stage.negotiation': 'Negotiation',
    'admin.crm.stage.nurture': 'Nurture',
    'admin.crm.stage.won': 'Won',
    'admin.crm.stage.lost': 'Lost',
    'admin.crm.type.rental': 'Rental',
    'admin.crm.type.purchase': 'Purchase',
    'admin.crm.type.sale': 'Sale',
    'admin.crm.type.management': 'Management',
    'admin.crm.type.developer_advisory': 'Developer advisory',
    'admin.crm.type.capex': 'Capex',
    'admin.crm.type.compliance': 'Compliance',
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
    'admin.crm.dashboard.loading': 'Loading pipeline summary…',
    'admin.crm.dashboard.error': 'Could not load CRM dashboard summary.',
    'admin.crm.dashboard.total_deals': 'Active opportunities',
    'admin.crm.dashboard.pipeline_value': 'Pipeline value',
    'admin.crm.dashboard.weighted_forecast': 'Weighted forecast',
    'admin.crm.dashboard.win_rate': 'Win rate',
    'admin.crm.dashboard.overdue_title': 'Overdue follow-ups',
    'admin.crm.dashboard.overdue_count': '{count} tasks past due',
    'admin.crm.lifecycle.title': 'Lifecycle pipeline',
    'admin.crm.lifecycle.subtitle':
      'Customer lifecycle stages from first contact through owner and managed portfolio.',
    'admin.crm.lifecycle.loading': 'Loading lifecycle pipeline…',
    'admin.crm.lifecycle.error': 'Could not load lifecycle pipeline.',
    'admin.crm.lifecycle.reason_prompt': 'Reason for this lifecycle transition',
    'admin.crm.lifecycle.col_email': 'Contact',
    'admin.crm.lifecycle.col_value': 'Pipeline value',
    'admin.crm.lifecycle.col_score': 'Lead score',
    'admin.crm.lifecycle.col_action': 'Move to',
    'admin.crm.lifecycle.move_to': 'Move to…',
    'admin.crm.lifecycle.stage.contact': 'Contact',
    'admin.crm.lifecycle.stage.guest': 'Guest',
    'admin.crm.lifecycle.stage.repeat': 'Repeat',
    'admin.crm.lifecycle.stage.prospect': 'Prospect',
    'admin.crm.lifecycle.stage.investor': 'Investor',
    'admin.crm.lifecycle.stage.buyer': 'Buyer',
    'admin.crm.lifecycle.stage.owner': 'Owner',
    'admin.crm.lifecycle.stage.managed': 'Managed',
    'admin.crm.lifecycle.stage.seller': 'Seller',
    'admin.crm.lifecycle.stage.former_client': 'Former client',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.crm.title']}
      </h1>
      <p className="text-body text-text-stone mb-24">{labels['admin.crm.subtitle']}</p>
      <CrmDashboardPanel labels={labels} />
      <CrmLifecyclePanel labels={labels} />
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

