import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import AdminContractsClient from './contracts-client';

export const dynamic = 'force-dynamic';

/**
 * Management contracts and earned fees (doc 10, CLAUDE.md fee transparency).
 * Wired to GET/POST /api/admin/contracts, GET /api/admin/fees/[contractId],
 * POST /api/admin/fees/calculate.
 */
export default async function AdminContractsPage() {
  const [projects, units] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.unit.findMany({
      select: {
        id: true,
        name: true,
        projectId: true,
        ownerIdentityId: true,
        owner: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const labels = await getLabels({
    'admin.contracts.title': 'Management contracts',
    'admin.contracts.subtitle':
      'Fee terms per unit — management and performance fees drive owner statements. Every rate is on the contract before bookings run.',
    'admin.contracts.loading': 'Loading contracts…',
    'admin.contracts.empty': 'No management contracts yet.',
    'admin.contracts.error': 'Could not load contracts.',
    'admin.contracts.create_title': 'New contract',
    'admin.contracts.create_submit': 'Create contract',
    'admin.contracts.field_project': 'Project',
    'admin.contracts.field_unit': 'Unit',
    'admin.contracts.field_owner': 'Owner',
    'admin.contracts.field_basis': 'Management fee basis',
    'admin.contracts.field_rate': 'Rate (decimal, e.g. 0.15 = 15%)',
    'admin.contracts.field_fixed': 'Fixed amount (satang)',
    'admin.contracts.field_start': 'Start date',
    'admin.contracts.field_end': 'End date (optional)',
    'admin.contracts.performance_enable': 'Performance fee enabled',
    'admin.contracts.performance_rate': 'Performance rate (decimal)',
    'admin.contracts.performance_baseline': 'NOI baseline (satang)',
    'admin.contracts.col_unit': 'Unit',
    'admin.contracts.col_project': 'Project',
    'admin.contracts.col_owner': 'Owner',
    'admin.contracts.col_basis': 'Fee basis',
    'admin.contracts.col_status': 'Status',
    'admin.contracts.col_period': 'Period',
    'admin.contracts.col_action': '',
    'admin.contracts.view_fees': 'Fees',
    'admin.contracts.calculate_title': 'Calculate fees for period',
    'admin.contracts.field_period_start': 'Period start',
    'admin.contracts.field_period_end': 'Period end',
    'admin.contracts.field_gop': 'GOP (satang)',
    'admin.contracts.field_noi': 'NOI (satang)',
    'admin.contracts.field_gross': 'Gross bookings (satang)',
    'admin.contracts.calculate_submit': 'Calculate & accrue',
    'admin.contracts.fees_title': 'Earned fees',
    'admin.contracts.fees_empty': 'No fees accrued for this contract yet.',
    'admin.contracts.fees_col_type': 'Type',
    'admin.contracts.fees_col_period': 'Period',
    'admin.contracts.fees_col_basis': 'Basis',
    'admin.contracts.fees_col_amount': 'Amount (฿)',
    'admin.contracts.fees_col_status': 'Status',
    'admin.contracts.close': 'Close',
    'admin.contracts.basis.percentage_gop': '% of GOP',
    'admin.contracts.basis.percentage_noi': '% of NOI',
    'admin.contracts.basis.percentage_gross_booking': '% of gross bookings',
    'admin.contracts.basis.fixed': 'Fixed fee',
    'admin.contracts.status.active': 'Active',
    'admin.contracts.status.pending_signature': 'Pending signature',
    'admin.contracts.status.expired': 'Expired',
    'admin.contracts.status.terminated': 'Terminated',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">
        {labels['admin.contracts.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.contracts.subtitle']}
      </p>
      <AdminContractsClient
        labels={labels}
        projects={projects}
        units={units
          .filter((u): u is typeof u & { ownerIdentityId: string } => u.ownerIdentityId !== null)
          .map((u) => ({
            id: u.id,
            name: u.name,
            projectId: u.projectId,
            ownerIdentityId: u.ownerIdentityId,
            ownerLabel: u.owner
              ? `${u.owner.firstName} ${u.owner.lastName}${u.owner.email ? ` (${u.owner.email})` : ''}`
              : u.ownerIdentityId,
          }))}
      />
    </div>
  );
}
