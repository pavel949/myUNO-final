import { getSchedulerHealth, jobsNeedingAttention, type JobHealthStatus } from '@/jobs';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const timestamp = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'short',
  timeStyle: 'medium',
});

const STATUS_CLASS: Record<JobHealthStatus, string> = {
  ok: 'bg-state-success-soft text-state-success',
  failed: 'bg-state-error-soft text-state-error',
  silent: 'bg-state-warning-soft text-state-warning',
  never: 'bg-state-error-soft text-state-error',
};

/**
 * Scheduler health (doc 15 §5, doc 08 §6). Every registered job is listed
 * even when it has never run — an empty table would hide a silent scheduler.
 */
export default async function AdminSchedulerPage() {
  const health = await getSchedulerHealth(prisma);
  const attention = jobsNeedingAttention(health);

  const labels = await getLabels({
    'admin.scheduler.title': 'Scheduler',
    'admin.scheduler.subtitle':
      'Each background job’s last run. A job that has not run when it should is a red light, not a mystery.',
    'admin.scheduler.headline.ok': 'All jobs have run on time.',
    'admin.scheduler.headline.attention': 'Need attention: {count}',
    'admin.scheduler.col.job': 'Job',
    'admin.scheduler.col.status': 'Status',
    'admin.scheduler.col.last_run': 'Last run',
    'admin.scheduler.col.outcome': 'Last outcome',
    'admin.scheduler.col.summary': 'Detail',
    'admin.scheduler.timezone_note': 'Times are Phuket time (UTC+7).',
    'admin.scheduler.status.ok': 'On schedule',
    'admin.scheduler.status.failed': 'Last run failed',
    'admin.scheduler.status.silent': 'Overdue — has not run',
    'admin.scheduler.status.never': 'Never run',
    'admin.scheduler.outcome.ok': 'Succeeded',
    'admin.scheduler.outcome.failed': 'Failed',
    'admin.scheduler.empty_summary': '—',
    'admin.scheduler.never_hint':
      'No recorded run. Either the scheduler is not firing, or this job has not been invoked since tracking began.',
    'admin.scheduler.job.booking_lifecycle': 'Hold expiry and request auto-decline',
    'admin.scheduler.job.tm30_escalations': 'TM30 filing escalations',
    'admin.scheduler.job.ical_sync': 'iCal import sync',
    'admin.scheduler.job.verification_deadlines': 'Pre-arrival verification deadlines',
    'admin.scheduler.job.retention': 'Retention and PDPA deletions',
    'admin.scheduler.job.metrics_rollup': 'Nightly metric rollup',
    'admin.scheduler.job.guest_lifecycle': 'Pre-arrival and post-stay messages',
    'admin.scheduler.job.service_order_expiry': 'Stale service-order expiry',
    'admin.scheduler.cadence.frequent': 'Daily, afternoon (Phuket)',
    'admin.scheduler.cadence.nightly': 'Nightly',
  });

  const headline =
    attention.length === 0
      ? labels['admin.scheduler.headline.ok']
      : labels['admin.scheduler.headline.attention'].replace('{count}', String(attention.length));

  const jobLabel = (key: string) =>
    labels[`admin.scheduler.job.${key}` as keyof typeof labels] ?? key;

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">
        {labels['admin.scheduler.title']}
      </h1>
      <p className="text-body text-text-secondary mb-16 max-w-3xl">
        {labels['admin.scheduler.subtitle']}
      </p>
      <p
        className={`text-body font-semibold mb-24 ${
          attention.length === 0 ? 'text-state-success' : 'text-state-error'
        }`}
      >
        {headline}
      </p>
      <p className="text-small text-text-secondary mb-16">{labels['admin.scheduler.timezone_note']}</p>
      {health.some((row) => row.status === 'never') ? (
        <p className="text-small text-text-secondary mb-16 max-w-3xl">
          {labels['admin.scheduler.never_hint']}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-small">
          <thead className="bg-surface-paper">
            <tr className="text-left text-text-secondary border-b border-border-line">
              <th className="px-12 py-12 font-semibold">{labels['admin.scheduler.col.job']}</th>
              <th className="px-12 py-12 font-semibold">{labels['admin.scheduler.col.status']}</th>
              <th className="px-12 py-12 font-semibold">{labels['admin.scheduler.col.last_run']}</th>
              <th className="px-12 py-12 font-semibold">{labels['admin.scheduler.col.outcome']}</th>
              <th className="px-12 py-12 font-semibold">{labels['admin.scheduler.col.summary']}</th>
            </tr>
          </thead>
          <tbody>
            {health.map((row) => (
              <tr key={row.key} className="border-b border-border-line align-top hover:bg-surface-paper">
                <td className="px-12 py-12">
                  <p className="font-semibold text-text-ink">{jobLabel(row.key)}</p>
                  <p className="text-xsmall text-text-secondary">
                    {row.cadence === 'frequent'
                      ? labels['admin.scheduler.cadence.frequent']
                      : labels['admin.scheduler.cadence.nightly']}
                  </p>
                </td>
                <td className="px-12 py-12 whitespace-nowrap">
                  <span
                    className={`px-8 py-4 rounded text-xsmall font-semibold ${STATUS_CLASS[row.status]}`}
                  >
                    {labels[`admin.scheduler.status.${row.status}` as keyof typeof labels]}
                  </span>
                </td>
                <td className="px-12 py-12 whitespace-nowrap font-mono text-xsmall">
                  {row.lastFinishedAt
                    ? timestamp.format(row.lastFinishedAt)
                    : labels['admin.scheduler.empty_summary']}
                </td>
                <td className="px-12 py-12 whitespace-nowrap">
                  {row.lastOutcome
                    ? labels[`admin.scheduler.outcome.${row.lastOutcome}` as keyof typeof labels]
                    : labels['admin.scheduler.empty_summary']}
                </td>
                <td className="px-12 py-12 font-mono text-xsmall text-text-secondary">
                  {row.summary || labels['admin.scheduler.empty_summary']}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
