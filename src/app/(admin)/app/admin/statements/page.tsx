import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import StatementActions from './statement-actions';

export const dynamic = 'force-dynamic';

export default async function AdminStatementsPage() {
  const [statements, units] = await Promise.all([
    prisma.ownerStatement.findMany({
      include: {
        owner: { select: { firstName: true, lastName: true } },
        unit: { select: { name: true } },
      },
      orderBy: { periodEnd: 'desc' },
      take: 50,
    }),
    prisma.unit.findMany({
      where: { engagements: { some: { status: 'active' } } },
      select: { id: true, name: true, owner: { select: { firstName: true, lastName: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const labels = await getLabels({
    'admin.statements.title': 'Monthly Statements',
    'admin.statements.empty': 'No statements yet.',
    'admin.statements.period': 'Period',
    'admin.statements.owner': 'Owner',
    'admin.statements.unit': 'Unit',
    'admin.statements.net': 'Net (฿)',
    'admin.statements.status': 'Status',
    'admin.statements.action': 'Action',
    'admin.statements.status.draft': 'Draft',
    'admin.statements.status.published': 'Published',
    'admin.statements.status.superseded': 'Superseded',
    'admin.statements.status.pending_owner_review': 'Awaiting owner',
    'admin.statements.status.signed_off': 'Signed off',
    'admin.statements.status.distributed': 'Distributed',
    'admin.statements.sign_off': 'Sign off (operator)',
    'admin.statements.signed_off_note': 'Signed by you',
    'admin.statements.working': 'Signing…',
    'admin.statements.error': 'That did not work.',
    'admin.statements.generate_title': 'Generate a statement',
    'admin.statements.generate_subtitle':
      'Computes the period’s figures from bookings and the ledger — nothing here is guessed or hand-entered.',
    'admin.statements.field_unit': 'Unit',
    'admin.statements.unit_empty': 'No unit has an active engagement yet.',
    'admin.statements.field_period_start': 'Period start',
    'admin.statements.field_period_end': 'Period end',
    'admin.statements.generate_submit': 'Generate',
    'admin.statements.generate_working': 'Generating…',
    'admin.statements.generate_success': 'Statement generated as a draft.',
    'admin.statements.view_lines': 'Line items',
    'admin.statements.hide_lines': 'Hide',
    'admin.statements.lines_loading': 'Loading line items…',
    'admin.statements.lines_empty': 'No line items on this statement.',
    'admin.statements.lines_category': 'Category',
    'admin.statements.lines_description': 'Description',
    'admin.statements.lines_amount': 'Amount (฿)',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
        {labels['admin.statements.title']}
      </h1>

      <StatementActions
        units={units.map((u) => ({
          id: u.id,
          label: u.owner ? `${u.name} — ${u.owner.firstName} ${u.owner.lastName}` : u.name,
        }))}
        statements={statements.map((s) => ({
          id: s.id,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          ownerName: `${s.owner.firstName} ${s.owner.lastName}`,
          unitName: s.unit.name,
          noiTh: s.noiTh,
          status: s.status,
          signedOffByOperatorAt: s.signedOffByOperatorAt?.toISOString() ?? null,
        }))}
        labels={labels}
      />
    </div>
  );
}
