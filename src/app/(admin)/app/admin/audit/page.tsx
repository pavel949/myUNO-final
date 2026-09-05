import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import {
  queryAuditLog,
  getAuditFacets,
  actionArea,
  AUDIT_PAGE_SIZE_DEFAULT,
  SYSTEM_ACTOR,
} from '@/modules/audit';

export const dynamic = 'force-dynamic';

/**
 * The audit log viewer (doc 08 §6, doc 12 §6).
 *
 * Every role grant, config change, PII read, statement publication and
 * retention purge has written a row since the first loop, and **nothing has
 * ever read one back**. The trail existed only as a promise.
 *
 * Deliberately a plain `GET` form rather than a client component: the whole
 * state of an audit is its filters, and putting them in the URL means an
 * auditor can bookmark a view, send it to counsel, or paste it into a report
 * and have the other person see exactly the same rows.
 *
 * Viewing is not itself audited. Recording every page of the audit log inside
 * the audit log buries the actions that matter under the act of looking at
 * them. The **export** is recorded instead (see the export route) — that is
 * the point at which the trail leaves the platform.
 */

interface SearchParams {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: string;
}

/** Phuket time, in a format that reads the same in every locale. */
const timestamp = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'short',
  timeStyle: 'medium',
});

function queryString(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Enough of the payload to recognise the entry, never so much it hides the row. */
function preview(data: unknown): string {
  if (data === null || data === undefined) return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Number(searchParams.page) || 1;

  const [result, facets, labels] = await Promise.all([
    queryAuditLog(prisma, {
      actor: searchParams.actor,
      action: searchParams.action,
      entityType: searchParams.entityType,
      entityId: searchParams.entityId,
      from: searchParams.from,
      to: searchParams.to,
      page,
      pageSize: AUDIT_PAGE_SIZE_DEFAULT,
    }),
    getAuditFacets(prisma),
    getLabels({
      'admin.audit.title': 'Audit trail',
      'admin.audit.subtitle':
        'Every privileged action the platform has recorded: who did it, to what, and when. Entries are written once and never changed.',
      'admin.audit.action': 'Action',
      'admin.audit.action_any': 'Any action',
      'admin.audit.action_area_all': 'Everything in this area',
      'admin.audit.entity_type': 'Record type',
      'admin.audit.entity_any': 'Any record type',
      'admin.audit.entity_id': 'Record reference',
      'admin.audit.from': 'From',
      'admin.audit.to': 'To',
      'admin.audit.apply': 'Apply',
      'admin.audit.clear': 'Clear filters',
      'admin.audit.export': 'Export this view (CSV)',
      'admin.audit.export_note':
        'Exports are themselves recorded, because that is when the trail leaves the platform.',
      'admin.audit.when': 'When',
      'admin.audit.who': 'Who',
      'admin.audit.what': 'What happened',
      'admin.audit.record': 'Record',
      'admin.audit.details': 'Details',
      'admin.audit.system_actor': 'System',
      'admin.audit.system_only': 'Only what the system did',
      'admin.audit.only_this_person': 'Only this person',
      'admin.audit.empty': 'Nothing matches these filters.',
      'admin.audit.empty_all': 'Nothing has been recorded yet.',
      'admin.audit.count': 'entries',
      'admin.audit.page_of': 'Page',
      'admin.audit.previous': '← Previous',
      'admin.audit.next': 'Next →',
      'admin.audit.timezone_note': 'Times are Phuket time (UTC+7).',
    }),
  ]);

  // Areas first, so "everything money-related" is one choice rather than six.
  const areas = Array.from(
    new Set(facets.actions.map((f) => actionArea(f.value)).filter((a): a is string => a !== null))
  ).sort();

  const filtered = Boolean(
    searchParams.actor ||
      searchParams.action ||
      searchParams.entityType ||
      searchParams.entityId ||
      searchParams.from ||
      searchParams.to
  );

  const field = 'px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink text-small';

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['admin.audit.title']}</h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.audit.subtitle']}
      </p>

      <form method="get" className="mb-16 flex flex-wrap gap-12 items-end">
        {searchParams.actor ? (
          <input type="hidden" name="actor" value={searchParams.actor} />
        ) : null}

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">{labels['admin.audit.action']}</span>
          <select name="action" defaultValue={searchParams.action || ''} className={field}>
            <option value="">{labels['admin.audit.action_any']}</option>
            {areas.map((area) => (
              <optgroup key={area} label={area}>
                <option value={`${area}:`}>{labels['admin.audit.action_area_all']}</option>
                {facets.actions
                  .filter((f) => actionArea(f.value) === area)
                  .map((f) => (
                    <option key={f.value} value={f.value}>
                      {`${f.value} (${f.count})`}
                    </option>
                  ))}
              </optgroup>
            ))}
            {facets.actions
              .filter((f) => actionArea(f.value) === null)
              .map((f) => (
                <option key={f.value} value={f.value}>
                  {`${f.value} (${f.count})`}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">{labels['admin.audit.entity_type']}</span>
          <select name="entityType" defaultValue={searchParams.entityType || ''} className={field}>
            <option value="">{labels['admin.audit.entity_any']}</option>
            {facets.entityTypes.map((f) => (
              <option key={f.value} value={f.value}>
                {`${f.value} (${f.count})`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">{labels['admin.audit.entity_id']}</span>
          <input
            type="text"
            name="entityId"
            defaultValue={searchParams.entityId || ''}
            className={`${field} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">{labels['admin.audit.from']}</span>
          <input type="date" name="from" defaultValue={searchParams.from || ''} className={field} />
        </label>

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">{labels['admin.audit.to']}</span>
          <input type="date" name="to" defaultValue={searchParams.to || ''} className={field} />
        </label>

        <button
          type="submit"
          className="px-16 py-8 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold"
        >
          {labels['admin.audit.apply']}
        </button>

        {filtered ? (
          <Link href="/app/admin/audit" className="text-small text-brand-andaman hover:underline py-8">
            {labels['admin.audit.clear']}
          </Link>
        ) : null}
      </form>

      <div className="mb-16 flex flex-wrap items-baseline gap-12">
        <p className="text-small text-text-secondary">
          {`${result.total} ${labels['admin.audit.count']} · ${labels['admin.audit.timezone_note']}`}
        </p>
        {searchParams.actor !== SYSTEM_ACTOR ? (
          <Link
            href={`/app/admin/audit${queryString(searchParams, {
              actor: SYSTEM_ACTOR,
              page: undefined,
            })}`}
            className="text-small text-brand-andaman hover:underline"
          >
            {labels['admin.audit.system_only']}
          </Link>
        ) : null}
        {result.total > 0 ? (
          <a
            href={`/api/admin/audit/export${queryString(searchParams, { page: undefined })}`}
            className="text-small text-brand-andaman hover:underline"
          >
            {labels['admin.audit.export']}
          </a>
        ) : null}
      </div>

      {result.entries.length === 0 ? (
        <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
          <p className="text-body text-text-secondary">
            {filtered ? labels['admin.audit.empty'] : labels['admin.audit.empty_all']}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="bg-surface-paper">
              <tr className="text-left text-text-secondary border-b border-border-line">
                <th className="px-12 py-12 font-semibold">{labels['admin.audit.when']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.audit.who']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.audit.what']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.audit.record']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.audit.details']}</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border-line align-top hover:bg-surface-paper">
                  <td className="px-12 py-8 whitespace-nowrap font-mono text-small">
                    {timestamp.format(entry.at)}
                  </td>
                  <td className="px-12 py-8 whitespace-nowrap">
                    {entry.actorIdentityId ? (
                      <Link
                        href={`/app/admin/audit${queryString(searchParams, {
                          actor: entry.actorIdentityId,
                          page: undefined,
                        })}`}
                        title={labels['admin.audit.only_this_person']}
                        className="text-brand-andaman hover:underline"
                      >
                        {entry.actorName}
                      </Link>
                    ) : (
                      <span className="text-text-secondary">{labels['admin.audit.system_actor']}</span>
                    )}
                  </td>
                  <td className="px-12 py-8">
                    <span className="px-8 py-4 bg-brand-andaman/10 text-brand-andaman rounded text-small font-semibold font-mono">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-12 py-8 font-mono text-small">
                    <Link
                      href={`/app/admin/audit${queryString(searchParams, {
                        entityType: entry.entityType,
                        entityId: entry.entityId,
                        page: undefined,
                      })}`}
                      className="text-brand-andaman hover:underline"
                    >
                      {`${entry.entityType} · ${entry.entityId}`}
                    </Link>
                  </td>
                  <td className="px-12 py-8 font-mono text-small text-text-secondary break-all">
                    {preview(entry.data)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <div className="mt-16 flex items-center gap-16">
          {result.page > 1 ? (
            <Link
              href={`/app/admin/audit${queryString(searchParams, { page: String(result.page - 1) })}`}
              className="text-small text-brand-andaman hover:underline"
            >
              {labels['admin.audit.previous']}
            </Link>
          ) : null}
          <span className="text-small text-text-secondary">
            {`${labels['admin.audit.page_of']} ${result.page} / ${result.pageCount}`}
          </span>
          {result.page < result.pageCount ? (
            <Link
              href={`/app/admin/audit${queryString(searchParams, { page: String(result.page + 1) })}`}
              className="text-small text-brand-andaman hover:underline"
            >
              {labels['admin.audit.next']}
            </Link>
          ) : null}
        </div>
      ) : null}

      <p className="mt-24 text-small text-text-secondary max-w-3xl">
        {labels['admin.audit.export_note']}
      </p>
    </div>
  );
}
