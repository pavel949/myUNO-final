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
      receipts: { where: { supersededAt: null }, select: { id: true }, take: 1 },
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
    'ops.costs.intro_v2':
      'Costs recorded here are counted in the owner report for the period they belong to, once that report is prepared.',
    'ops.costs.unit': 'Unit',
    'ops.costs.type': 'Type',
    'ops.costs.amount': 'Amount (฿)',
    'ops.costs.date': 'Date incurred',
    'ops.costs.description': 'What it was for',
    'ops.costs.submit': 'Record cost',
    'ops.costs.saving': 'Recording…',
    'ops.costs.error': 'Could not record that cost.',
    'ops.costs.recent': 'Recorded by you, most recent first',
    'ops.costs.none': 'You have not recorded any costs yet.',
    'catalog.ledger_entry_types.cleaning_cost.label': 'Cleaning',
    'catalog.ledger_entry_types.maintenance_cost.label': 'Maintenance',
    'catalog.ledger_entry_types.consumables_cost.label': 'Consumables',
    'catalog.ledger_entry_types.utilities_cost.label': 'Utilities',
    'catalog.ledger_entry_types.adjustment.label': 'Adjustment',
    'ops.costs.receipt':
      'Receipt (optional)',
    'ops.costs.receipt_hint':
      'PDF, JPEG, PNG or WebP, up to 4 MB. Stored privately and never shown publicly.',
    'ops.costs.receipt_attach':
      'Attach receipt',
    'ops.costs.receipt_view':
      'View receipt',
    'ops.costs.receipt_none':
      'No receipt',
    'ops.costs.receipt_uploading':
      'Uploading receipt…',
    'ops.costs.receipt_saved':
      'Receipt attached.',
    'ops.costs.receipt_retry':
      'Retry upload',
    'ops.costs.receipt_pending':
      'The cost is recorded, but its receipt did not upload. Your file is kept; retrying will not add a second cost.',
    'ops.costs.receipt_error.unsupported_type':
      'Only PDF, JPEG, PNG and WebP files are accepted.',
    'ops.costs.receipt_error.too_large':
      'The file is larger than 4 MB.',
    'ops.costs.receipt_error.empty':
      'The file is empty.',
    'ops.costs.receipt_error.reused':
      'This file is already attached to another cost.',
    'ops.costs.receipt_error.locked':
      'This cost is on an issued owner report, so its receipt can no longer change.',
    'ops.costs.receipt_error.forbidden':
      'You cannot attach a receipt to this cost.',
    'ops.costs.receipt_error.generic':
      'Could not upload the receipt. Try again.',
    'ops.costs.impact.no_statement':
      'Recorded. It will be counted when the owner report for this period is prepared.',
    'ops.costs.impact.draft_stale':
      'Recorded. The draft owner report for {start} – {end} was prepared before this cost, so it does not include it yet. An administrator can regenerate the draft.',
    'ops.costs.impact.issued':
      'Recorded. The owner report for {start} – {end} has already been issued and does not include this cost. It will be carried into the next owner report prepared for this unit.',
    'ops.costs.replayed':
      'This cost was already recorded; nothing was added twice.',
    'ops.costs.error.conflict':
      'This attempt was already used for a different cost. Check the list below, then record again if needed.',
    'ops.costs.error.network':
      'No connection to the server. Your entry is kept, and retrying will not add a second cost.',
    'ops.costs.error.forbidden':
      'You are not allowed to record costs on this unit.',
    'ops.costs.error.future_date':
      'The date must be a real day that is not in the future.',
    'ops.costs.error.invalid_amount':
      'Enter an amount greater than zero.',
    'ops.costs.error.invalid_description':
      'Describe what the cost was for (3 to 500 characters).',
    'ops.costs.correction_note':
      'A recorded cost cannot be edited or deleted. A mistake is corrected by an administrator with a reversal that stays visible in the history.',
    'ops.costs.no_units':
      'There are no units you can record costs on.',
  });

  return (
    <main className="stitch-workspace p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link href={backHref} className="text-brand-andaman font-semibold hover:underline">
            {labels['mc.costs.back']}
          </Link>
        </p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['mc.costs.title']}</h1>
        <p className="text-body text-text-secondary mb-16">{labels['ops.costs.intro_v2']}</p>

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
            // Stored negative (an outflow); the screen shows the magnitude.
            amountThb: Math.abs(e.amountThb),
            receiptId: e.receipts[0]?.id ?? null,
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
