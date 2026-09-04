import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import RecordCostClient from './record-cost-client';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';
import {
  loadOpsSwitcherProjects,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';

export const dynamic = 'force-dynamic';

interface RecordCostPageProps {
  searchParams?: {
    projectId?: string;
  };
}

/**
 * Recording a cost (doc 07 F-OPS-3).
 */
export default async function RecordCostPage({ searchParams }: RecordCostPageProps) {
  const user = await getCurrentUser();
  if (!user?.identityId) redirect('/login?next=/ops/costs');

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  if (!opsContext.isAdmin && opsContext.staffProjectIds.length === 0) {
    redirect('/');
  }

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );

  const unitProjectFilter = validActiveProjectId
    ? { projectId: validActiveProjectId }
    : opsContext.isAdmin
      ? {}
      : { projectId: { in: opsContext.staffProjectIds } };

  const units = await prisma.unit.findMany({
    where: unitProjectFilter,
    select: { id: true, name: true, project: { select: { name: true } } },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
  });

  const recent = await prisma.ledgerEntry.findMany({
    where: {
      createdByIdentityId: user.identityId,
      entryType: { in: ['cleaning_cost', 'maintenance_cost', 'consumables_cost', 'utilities_cost', 'adjustment'] },
      ...(validActiveProjectId
        ? { unit: { projectId: validActiveProjectId } }
        : opsContext.isAdmin
          ? {}
          : { unit: { projectId: { in: opsContext.staffProjectIds } } }),
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
    'ops.costs.back': '← Ops board',
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
    'ops.costs.immutable':
      'A recorded cost cannot be edited or deleted — the ledger is append-only. A mistake is corrected by recording an adjustment.',
    'catalog.ledger_entry_types.cleaning_cost.label': 'Cleaning',
    'catalog.ledger_entry_types.maintenance_cost.label': 'Maintenance',
    'catalog.ledger_entry_types.consumables_cost.label': 'Consumables',
    'catalog.ledger_entry_types.utilities_cost.label': 'Utilities',
    'catalog.ledger_entry_types.adjustment.label': 'Adjustment',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const switcherBasePath = '/ops/costs';

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link
            href={opsHref('/ops', validActiveProjectId)}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels['ops.costs.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['ops.costs.title']}</h1>
        <p className="text-body text-text-secondary mb-24">{labels['ops.costs.intro']}</p>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath={switcherBasePath}
          labels={labels}
        />

        <RecordCostClient
          embedded
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
      </div>
    </main>
  );
}
