import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import AdminOperationalKpisClient from './kpis-client';

export const dynamic = 'force-dynamic';

export default async function AdminOperationalKpisPage() {
  const units = await prisma.unit.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  const labels = await getLabels({
    'admin.kpis.title': 'Operational KPIs',
    'admin.kpis.subtitle':
      'Unit-level performance metrics — occupancy, revenue, SLA compliance. Track targets vs actuals per period.',
    'admin.kpis.loading': 'Loading KPIs…',
    'admin.kpis.empty': 'No KPIs match this filter.',
    'admin.kpis.error': 'Could not load KPIs.',
    'admin.kpis.filter_all': 'All',
    'admin.kpis.filter_on_track': 'On track',
    'admin.kpis.filter_at_risk': 'At risk',
    'admin.kpis.filter_below': 'Below target',
    'admin.kpis.create_title': 'Record KPI',
    'admin.kpis.create_submit': 'Save KPI',
    'admin.kpis.select_unit': 'Select unit…',
    'admin.kpis.col_unit': 'Unit',
    'admin.kpis.col_metric': 'Metric',
    'admin.kpis.col_period': 'Period',
    'admin.kpis.col_period_start': 'Period start',
    'admin.kpis.col_period_end': 'Period end',
    'admin.kpis.col_target': 'Target',
    'admin.kpis.col_actual': 'Actual',
    'admin.kpis.col_status': 'Status',
    'admin.kpis.status.on_track': 'On track',
    'admin.kpis.status.at_risk': 'At risk',
    'admin.kpis.status.below_target': 'Below target',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['admin.kpis.title']}</h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.kpis.subtitle']}
      </p>
      <AdminOperationalKpisClient labels={labels} units={units} />
    </div>
  );
}
