import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getMCManagedUnits } from '@/modules/projects';
import { getMCProjectScopes } from '@/app/libs/projectScope';
import RecordCostClient from '@/app/ops/costs/record-cost-client';

export const dynamic = 'force-dynamic';

interface McCostsPageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
  };
}

/**
 * Record costs on MC-managed units (doc 07 F-MC-2 / F-OPS-3).
 * Reuses the ops cost form; scope is limited to units under the active MC engagement.
 */
export default async function McCostsPage({ searchParams }: McCostsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc/costs');
  }

  const mcScopes = getMCProjectScopes(user);
  if (mcScopes.length === 0) {
    redirect('/');
  }

  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null;
  const requestedOrganizationId =
    typeof searchParams?.organizationId === 'string' ? searchParams.organizationId : null;

  const activeScope =
    mcScopes.find(
      (scope) =>
        scope.projectId === requestedProjectId &&
        (!requestedOrganizationId || scope.organizationId === requestedOrganizationId)
    ) ||
    (requestedProjectId ? mcScopes.find((scope) => scope.projectId === requestedProjectId) : null) ||
    mcScopes[0];

  const projectIds = Array.from(new Set(mcScopes.map((scope) => scope.projectId)));
  const organizationIds = Array.from(new Set(mcScopes.map((scope) => scope.organizationId)));
  const [projects, organizations] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    }),
    prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
    }),
  ]);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const organizationNameById = new Map(
    organizations.map((organization) => [organization.id, organization.name])
  );

  const contexts = mcScopes.map((scope) => ({
    key: `${scope.projectId}:${scope.organizationId}`,
    href: `/mc/costs?projectId=${encodeURIComponent(scope.projectId)}&organizationId=${encodeURIComponent(
      scope.organizationId
    )}`,
    label: `${projectNameById.get(scope.projectId) || scope.projectId} · ${
      organizationNameById.get(scope.organizationId) || scope.organizationId
    }`,
  }));

  const managedUnits = await getMCManagedUnits(
    prisma,
    user.identityId,
    activeScope.projectId,
    activeScope.organizationId
  );
  const unitIds = managedUnits.map((unit) => unit.id);

  const recent = await prisma.ledgerEntry.findMany({
    where: {
      createdByIdentityId: user.identityId,
      unitId: { in: unitIds },
      entryType: {
        in: ['cleaning_cost', 'maintenance_cost', 'consumables_cost', 'utilities_cost', 'adjustment'],
      },
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

  const backHref = `/mc?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
    activeScope.organizationId
  )}`;

  const labels = await getLabels({
    'mc.costs.title': 'Record a cost',
    'mc.costs.back': '← MC portal',
    'mc.costs.context': 'Portfolio context',
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
    'ops.costs.immutable':
      'A recorded cost cannot be edited or deleted — the ledger is append-only. A mistake is corrected by recording an adjustment.',
    'catalog.ledger_entry_types.cleaning_cost.label': 'Cleaning',
    'catalog.ledger_entry_types.maintenance_cost.label': 'Maintenance',
    'catalog.ledger_entry_types.consumables_cost.label': 'Consumables',
    'catalog.ledger_entry_types.utilities_cost.label': 'Utilities',
    'catalog.ledger_entry_types.adjustment.label': 'Adjustment',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link href={backHref} className="text-brand-andaman font-semibold hover:underline">
            {labels['mc.costs.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['mc.costs.title']}</h1>
        <p className="text-body text-text-secondary mb-16">{labels['ops.costs.intro']}</p>

        {contexts.length > 1 ? (
          <div className="mb-24">
            <p className="text-small text-text-secondary mb-8">{labels['mc.costs.context']}</p>
            <div className="flex flex-wrap gap-8">
              {contexts.map((context) => (
                <Link
                  key={context.key}
                  href={context.href}
                  className={`px-12 py-8 rounded-full text-small font-semibold border ${
                    context.key === `${activeScope.projectId}:${activeScope.organizationId}`
                      ? 'bg-brand-andaman text-surface-ivory border-brand-andaman'
                      : 'bg-surface-paper text-text-ink border-border-line hover:border-brand-andaman'
                  }`}
                >
                  {context.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <RecordCostClient
          embedded
          units={managedUnits.map((u) => ({
            id: u.id,
            name: u.name,
            projectName: projectNameById.get(activeScope.projectId) || activeScope.projectId,
          }))}
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
