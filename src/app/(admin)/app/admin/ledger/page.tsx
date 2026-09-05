import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listProjects } from '@/modules/projects';
import LedgerAdminClient from './ledger-client';

export const dynamic = 'force-dynamic';

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: { projectId?: string; startDate?: string; endDate?: string };
}) {
  const projects = await listProjects();
  const projectId =
    searchParams.projectId && projects.some((p) => p.id === searchParams.projectId)
      ? searchParams.projectId
      : projects[0]?.id;

  const where: any = {};
  if (projectId) where.projectId = projectId;

  if (searchParams.startDate || searchParams.endDate) {
    where.occurredOn = {};
    if (searchParams.startDate) where.occurredOn.gte = new Date(searchParams.startDate);
    if (searchParams.endDate) where.occurredOn.lte = new Date(searchParams.endDate);
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { occurredOn: 'desc' },
    take: 200,
  });

  // Accumulated in satang (the ledger's native unit), then converted to baht
  // once below — matches every entry's amountThb passed to the client.
  const totalsThb = entries.reduce(
    (acc, entry) => {
      acc[entry.entryType] = (acc[entry.entryType] || 0) + entry.amountThb;
      return acc;
    },
    {} as Record<string, number>
  );
  const totals = Object.fromEntries(
    Object.entries(totalsThb).map(([type, amountThb]) => [type, amountThb / 100])
  );

  const labels = await getLabels({
    'admin.ledger.title': 'Ledger (append-only)',
    'admin.ledger.subtitle': 'All financial entries: bookings, refunds, services, costs',
    'admin.ledger.project': 'Project',
    'admin.ledger.empty': 'No entries for this period.',
    'admin.ledger.no_projects': 'Create a project first.',
    'admin.ledger.type': 'Type',
    'admin.ledger.amount': 'Amount (฿)',
    'admin.ledger.date': 'Date',
    'admin.ledger.unit': 'Unit',
    'admin.ledger.description': 'Description',
    'admin.ledger.created_by': 'Created by',
    'admin.ledger.reverse': 'Reverse',
    'admin.ledger.totals': 'Totals by type',
    'admin.ledger.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['admin.ledger.title']}</h1>
      <p className="text-body text-text-secondary mb-24">{labels['admin.ledger.subtitle']}</p>
      {projectId ? (
        <LedgerAdminClient
          projectId={projectId}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          entries={entries.map((e) => ({
            id: e.id,
            entryType: e.entryType,
            // Satang -> baht at the display boundary (CLAUDE.md money rules; Q47).
            amountThb: e.amountThb / 100,
            unitName: e.unit?.name || '—',
            description: e.description,
            occurredOn: e.occurredOn.toISOString(),
            createdBy: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : '—',
            bookingId: e.bookingId,
            serviceOrderId: e.serviceOrderId,
          }))}
          totals={totals}
          labels={labels}
        />
      ) : (
        <p className="text-body text-text-secondary">{labels['admin.ledger.no_projects']}</p>
      )}
    </div>
  );
}
