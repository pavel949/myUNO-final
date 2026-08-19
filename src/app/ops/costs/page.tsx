import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import RecordCostClient from './record-cost-client';

export const dynamic = 'force-dynamic';

/**
 * Recording a cost (doc 07 F-OPS-3).
 *
 * `POST /api/ledger/record-cost` existed and no screen reached it, so an
 * expense could only be entered by hand-crafting a request. An owner statement
 * subtracts operating expenses from gross bookings — with nothing able to
 * record one, every statement showed revenue with no costs against it, which is
 * not a statement so much as a half of one.
 */
export default async function RecordCostPage() {
  const user = await getCurrentUser();
  if (!user?.identityId) redirect('/login?next=/ops/costs');

  // Scoped to what this person operates: staff see their projects' units, an
  // admin sees all. Anyone else has no business on this screen.
  const scopedProjectIds = user.roles
    .filter((r) => ['staff_ops', 'onsite_host'].includes(r.role) && r.projectId)
    .map((r) => r.projectId as string);

  if (!user.isAdmin && scopedProjectIds.length === 0) {
    redirect('/');
  }

  const units = await prisma.unit.findMany({
    where: user.isAdmin ? {} : { projectId: { in: scopedProjectIds } },
    select: { id: true, name: true, project: { select: { name: true } } },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
  });

  const recent = await prisma.ledgerEntry.findMany({
    where: {
      createdByIdentityId: user.identityId,
      entryType: { in: ['cleaning_cost', 'maintenance_cost', 'consumables_cost', 'utilities_cost', 'adjustment'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      entryType: true,
      amountThb: true,
      occurredOn: true,
      description: true,
      unit: { select: { name: true } },
    },
  });

  const labels = await getLabels({
    'ops.costs.title': 'Record a cost',
    'ops.costs.intro': 'Costs recorded here appear on the owner statement for that unit.',
    'ops.costs.unit': 'Unit',
    'ops.costs.type': 'Type',
    'ops.costs.amount': 'Amount (฿)',
    'ops.costs.date': 'Date incurred',
    'ops.costs.description': 'What it was for',
    'ops.costs.submit': 'Record cost',
    'ops.costs.saving': 'Recording…',
    'ops.costs.saved': 'Recorded. It will appear on the next statement.',
    'ops.costs.error': 'Could not record that cost.',
    'ops.costs.recent': 'Recorded by you, most recent first',
    'ops.costs.none': 'You have not recorded any costs yet.',
    'ops.costs.immutable': 'A recorded cost cannot be edited or deleted — the ledger is append-only. A mistake is corrected by recording an adjustment.',
    'catalog.ledger_entry_types.cleaning_cost.label': 'Cleaning',
    'catalog.ledger_entry_types.maintenance_cost.label': 'Maintenance',
    'catalog.ledger_entry_types.consumables_cost.label': 'Consumables',
    'catalog.ledger_entry_types.utilities_cost.label': 'Utilities',
    'catalog.ledger_entry_types.adjustment.label': 'Adjustment',
  });

  return (
    <RecordCostClient
      units={units.map((u) => ({ id: u.id, name: u.name, projectName: u.project?.name ?? '—' }))}
      recent={recent.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        amountThb: e.amountThb,
        occurredOn: e.occurredOn.toISOString().slice(0, 10),
        description: e.description ?? '',
        unitName: e.unit?.name ?? '—',
      }))}
      labels={labels}
    />
  );
}
