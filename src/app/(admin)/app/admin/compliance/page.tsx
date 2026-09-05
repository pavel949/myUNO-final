import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAdminComplianceOverview } from '@/modules/core';
import { safeDecrypt } from '@/modules/ops';
import ComplianceProjectFilter from './compliance-project-filter';

export const dynamic = 'force-dynamic';

const TM30_STATUS_ORDER = ['escalated', 'failed', 'pending', 'filed', 'not_required'];

type Labels = Record<string, string>;

function tm30StatusLabel(status: string, labels: Labels): string {
  return labels[`admin.compliance.status.${status}`] || status;
}

function recordTypeLabel(recordType: string, labels: Labels): string {
  return labels[`admin.compliance.record_type.${recordType}`] || recordType;
}

function recordStatusLabel(status: string, labels: Labels): string {
  return labels[`admin.compliance.record.${status}`] || status;
}

function tm30Tone(status: string): string {
  if (status === 'filed') return 'bg-state-success-soft text-state-success';
  if (status === 'escalated' || status === 'failed') return 'bg-state-error-soft text-state-error';
  if (status === 'pending') return 'bg-state-warning-soft text-state-warning';
  return 'bg-surface-ivory text-text-stone';
}

/**
 * Admin compliance dashboard (doc 08 §6 §11): TM30 ledger, unit records,
 * retention posture.
 */
export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams?: { projectId?: string };
}) {
  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';

  const projects = await prisma.project.findMany({
    where: { status: { in: ['live', 'draft'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const activeProjectId =
    requestedProjectId && projects.some((project) => project.id === requestedProjectId)
      ? requestedProjectId
      : '';

  const overview = await getAdminComplianceOverview(prisma, {
    projectId: activeProjectId || undefined,
  });

  const labels = (await getLabels({
    'admin.compliance.title': 'Compliance',
    'admin.compliance.subtitle':
      'TM30 filings, per-unit compliance records, and passport retention — the operational proof that immigration and licensing obligations are being met.',
    'admin.compliance.project_filter': 'Project',
    'admin.compliance.all_projects': 'All projects',
    'admin.compliance.tm30_title': 'TM30 ledger',
    'admin.compliance.tm30_open_queue': 'Open the ops TM30 queue →',
    'admin.compliance.tm30_empty': 'No TM30 filings recorded yet.',
    'admin.compliance.tm30_due': 'Due',
    'admin.compliance.tm30_filed': 'Filed',
    'admin.compliance.tm30_guest': 'Guest',
    'admin.compliance.tm30_unit': 'Unit',
    'admin.compliance.tm30_status': 'Status',
    'admin.compliance.records_title': 'Records needing attention',
    'admin.compliance.records_empty': 'No pending or expiring compliance records.',
    'admin.compliance.records_expires': 'Expires',
    'admin.compliance.records_open_unit': 'Open unit onboarding →',
    'admin.compliance.retention_title': 'Retention jobs',
    'admin.compliance.retention_passport_days':
      'Passport data is scrubbed {days} days after checkout.',
    'admin.compliance.retention_passports_due':
      '{count} guest passport records are past the retention window and due for scrubbing on the next job run.',
    'admin.compliance.retention_media_due':
      '{count} media assets are marked for deletion.',
    'admin.compliance.retention_last_run': 'Last retention job completed',
    'admin.compliance.retention_never': 'No completed retention job recorded yet.',
    'admin.compliance.status.pending': 'Pending',
    'admin.compliance.status.filed': 'Filed',
    'admin.compliance.status.failed': 'Failed',
    'admin.compliance.status.escalated': 'Escalated',
    'admin.compliance.status.not_required': 'Not required',
    'admin.compliance.record.pending': 'Pending review',
    'admin.compliance.record.confirmed': 'Confirmed',
    'admin.compliance.record.expired': 'Expired',
    'admin.compliance.record.failed': 'Failed',
    'admin.compliance.record_type.permitted_use': 'Permitted use',
    'admin.compliance.record_type.insurance': 'Insurance',
    'admin.compliance.record_type.license': 'License',
    'admin.compliance.record_type.title_audit': 'Title audit',
    'admin.compliance.record_type.other': 'Other',
  })) as Labels;

  const tm30Sorted = [...overview.tm30Filings].sort((a, b) => {
    const ai = TM30_STATUS_ORDER.indexOf(a.status);
    const bi = TM30_STATUS_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });

  const tm30QueueHref = activeProjectId
    ? `/ops/tm30?projectId=${encodeURIComponent(activeProjectId)}`
    : '/ops/tm30';

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">
        {labels['admin.compliance.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.compliance.subtitle']}
      </p>

      <ComplianceProjectFilter
        projects={projects}
        activeProjectId={activeProjectId}
        labels={labels}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-24">
        {TM30_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="bg-surface-paper border border-border-line rounded-lg p-16 text-center"
          >
            <p className="text-caption text-text-secondary mb-4">
              {tm30StatusLabel(status, labels)}
            </p>
            <p className="text-heading-3 font-bold text-text-ink tabular-nums">
              {overview.tm30Counts[status] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-12 mb-16">
          <h2 className="text-heading-3 font-bold text-text-ink">
            {labels['admin.compliance.tm30_title']}
          </h2>
          <Link href={tm30QueueHref} className="text-body text-brand-andaman font-semibold hover:underline">
            {labels['admin.compliance.tm30_open_queue']}
          </Link>
        </div>

        {tm30Sorted.length === 0 ? (
          <p className="text-body text-text-secondary">{labels['admin.compliance.tm30_empty']}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-line">
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['admin.compliance.tm30_guest']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['admin.compliance.tm30_unit']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['admin.compliance.tm30_due']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8">
                    {labels['admin.compliance.tm30_status']}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tm30Sorted.map((filing) => {
                  const guestName =
                    safeDecrypt(filing.guestNameEncrypted) ||
                    filing.guestNationality ||
                    '—';
                  return (
                    <tr key={filing.id} className="border-b border-border-line last:border-b-0">
                      <td className="text-body py-12 pr-16">{guestName}</td>
                      <td className="text-body py-12 pr-16">
                        {filing.unitName}
                        <span className="text-caption text-text-secondary block">
                          {filing.projectName}
                        </span>
                      </td>
                      <td className="text-body py-12 pr-16 whitespace-nowrap">
                        {filing.dueAt.toLocaleString()}
                        {filing.filedAt && (
                          <span className="text-caption text-text-secondary block">
                            {labels['admin.compliance.tm30_filed']}:{' '}
                            {filing.filedAt.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-12">
                        <span
                          className={`inline-flex px-10 py-4 rounded-full text-small font-semibold ${tm30Tone(
                            filing.status
                          )}`}
                        >
                          {tm30StatusLabel(filing.status, labels)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.compliance.records_title']}
        </h2>

        {overview.complianceRecords.length === 0 ? (
          <p className="text-body text-text-secondary">
            {labels['admin.compliance.records_empty']}
          </p>
        ) : (
          <ul className="space-y-12">
            {overview.complianceRecords.map((record) => (
              <li
                key={record.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 py-12 border-b border-border-line last:border-b-0"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">
                    {recordTypeLabel(record.recordType, labels)}
                    <span className="text-text-secondary font-normal">
                      {' '}
                      · {record.unitName}
                    </span>
                  </p>
                  <p className="text-small text-text-secondary">
                    {record.projectName} ·{' '}
                    {recordStatusLabel(record.status, labels)}
                    {record.expiresOn
                      ? ` · ${labels['admin.compliance.records_expires']} ${record.expiresOn.toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={`/app/admin/units/${record.unitId}`}
                  className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                >
                  {labels['admin.compliance.records_open_unit']}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.compliance.retention_title']}
        </h2>
        <ul className="space-y-12 text-body text-text-secondary">
          <li>
            {labels['admin.compliance.retention_passport_days'].replace(
              '{days}',
              String(overview.retention.passportRetentionDays)
            )}
          </li>
          <li>
            {labels['admin.compliance.retention_passports_due'].replace(
              '{count}',
              String(overview.retention.passportsEligibleForScrub)
            )}
          </li>
          <li>
            {labels['admin.compliance.retention_media_due'].replace(
              '{count}',
              String(overview.retention.mediaPendingDeletion)
            )}
          </li>
          <li>
            {overview.retention.lastJobCompletedAt
              ? `${labels['admin.compliance.retention_last_run']}: ${new Date(
                  overview.retention.lastJobCompletedAt
                ).toLocaleString()}`
              : labels['admin.compliance.retention_never']}
          </li>
        </ul>
      </section>
    </div>
  );
}
