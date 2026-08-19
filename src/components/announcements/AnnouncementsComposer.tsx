'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AUDIENCES = ['everyone', 'owners', 'residents', 'guests_in_stay', 'staff'] as const;

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  postedAs: string;
  status: string;
  isPinned: boolean;
  isImportant: boolean;
  expiresAt: string | null;
  createdAt: string;
  author: string;
  organizationName: string | null;
}

interface Props {
  projectId: string;
  projects: { id: string; name: string }[];
  announcements: Announcement[];
  labels: Record<string, string>;
  /**
   * Where the project switcher navigates. The same composer serves the admin
   * panel and the management-company / juristic portals — the difference
   * between them is which projects they are handed, not what writing an
   * announcement looks like.
   */
  basePath: string;
  /**
   * Which audiences this poster may address. An organisation speaks to the
   * people in its building; only myUNO addresses its own staff.
   */
  audiences?: readonly string[];
}

export function AnnouncementsComposer({
  projectId,
  projects,
  announcements,
  labels,
  basePath,
  audiences = AUDIENCES,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string>('everyone');
  const [isPinned, setIsPinned] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const field =
    'px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink text-small w-full';

  const fail = useCallback(
    async (res: Response | null) => {
      const payload = await res?.json().catch(() => null);
      setError(payload?.error || labels['admin.announcements.error']);
    },
    [labels]
  );

  const saveDraft = useCallback(async () => {
    setBusy('draft');
    setError(null);
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title,
        body,
        audience,
        isPinned,
        isImportant,
        // A date input gives a day; an announcement stops showing at the end of
        // it, not at the first second of it.
        expiresAt: expiresAt ? `${expiresAt}T23:59:59+07:00` : undefined,
      }),
    }).catch(() => null);

    if (res?.ok) {
      setTitle('');
      setBody('');
      setExpiresAt('');
      setIsPinned(false);
      setIsImportant(false);
      router.refresh();
    } else {
      await fail(res);
    }
    setBusy(null);
  }, [projectId, title, body, audience, isPinned, isImportant, expiresAt, router, fail]);

  const act = useCallback(
    async (id: string, path: string, method: string) => {
      setBusy(id);
      setError(null);
      const res = await fetch(path, { method }).catch(() => null);
      if (res?.ok) router.refresh();
      else await fail(res);
      setBusy(null);
    },
    [router, fail]
  );

  const canSave = title.trim().length > 0 && body.trim().length > 0 && busy === null;

  return (
    <div>
      <div className="mb-24">
        <select
          value={projectId}
          onChange={(e) => router.push(`${basePath}?projectId=${e.target.value}`)}
          className="px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <section className="mb-32 p-16 bg-surface-paper border border-border-line rounded-lg max-w-2xl">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.announcements.compose']}
        </h2>

        <label className="block mb-12">
          <span className="text-small text-text-secondary block mb-4">
            {labels['admin.announcements.headline']}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
        </label>

        <label className="block mb-12">
          <span className="text-small text-text-secondary block mb-4">
            {labels['admin.announcements.body']}
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className={field}
          />
        </label>

        <label className="block mb-12">
          <span className="text-small text-text-secondary block mb-4">
            {labels['admin.announcements.audience']}
          </span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={field}
          >
            {audiences.map((value) => (
              <option key={value} value={value}>
                {labels[`admin.announcements.audience.${value}`]}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-small text-text-secondary block mb-4">
            {labels['admin.announcements.expires']}
          </span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={field}
          />
        </label>
        <p className="text-xsmall text-text-secondary mb-12">
          {labels['admin.announcements.expires_hint']}
        </p>

        <label className="flex items-center gap-8 mb-8 text-small text-text-ink">
          <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
          {labels['admin.announcements.pinned']}
        </label>
        <label className="flex items-center gap-8 mb-16 text-small text-text-ink">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
          />
          {labels['admin.announcements.important']}
        </label>

        <button
          type="button"
          onClick={saveDraft}
          disabled={!canSave}
          className="px-16 py-8 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold disabled:opacity-50"
        >
          {busy === 'draft'
            ? labels['admin.announcements.saving']
            : labels['admin.announcements.save_draft']}
        </button>

        <p className="mt-12 text-xsmall text-text-secondary">
          {labels['admin.announcements.posted_as_note']}
        </p>
      </section>

      {error ? (
        <p className="mb-16 text-small text-status-error" role="alert">
          {error}
        </p>
      ) : null}

      {announcements.length === 0 ? (
        <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
          <p className="text-body text-text-secondary">{labels['admin.announcements.empty']}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-12">
          {announcements.map((a) => {
            const expired = a.expiresAt !== null && new Date(a.expiresAt) < new Date();
            return (
              <li
                key={a.id}
                className="p-16 bg-surface-paper border border-border-line rounded-lg"
              >
                <div className="flex flex-wrap items-baseline gap-8 mb-8">
                  <span className="px-8 py-4 bg-brand-andaman/10 text-brand-andaman rounded text-xsmall font-semibold">
                    {labels[`admin.announcements.status.${a.status}`]}
                  </span>
                  <span className="text-xsmall text-text-secondary">
                    {labels[`admin.announcements.audience.${a.audience}`]}
                  </span>
                  <span className="text-xsmall text-text-secondary">
                    {`${labels['admin.announcements.posted_as']} ${
                      labels[`admin.announcements.posted_as.${a.postedAs}`]
                    }${a.organizationName ? ` · ${a.organizationName}` : ''}`}
                  </span>
                  {expired ? (
                    <span className="text-xsmall text-text-secondary">
                      {labels['admin.announcements.expired']}
                    </span>
                  ) : null}
                </div>

                <p className="text-body font-semibold text-text-ink mb-4">{a.title}</p>
                <p className="text-small text-text-secondary whitespace-pre-wrap mb-12">{a.body}</p>

                <div className="flex flex-wrap gap-12 items-center">
                  {a.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => act(a.id, `/api/announcements/${a.id}/publish`, 'POST')}
                      disabled={busy !== null}
                      className="px-12 py-4 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold disabled:opacity-50"
                    >
                      {busy === a.id
                        ? labels['admin.announcements.publishing']
                        : labels['admin.announcements.publish']}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => act(a.id, `/api/announcements/${a.id}/publish`, 'DELETE')}
                      disabled={busy !== null}
                      className="text-small text-brand-andaman hover:underline disabled:opacity-50"
                    >
                      {labels['admin.announcements.unpublish']}
                    </button>
                  )}

                  {a.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={() => act(a.id, `/api/announcements/${a.id}`, 'DELETE')}
                      disabled={busy !== null}
                      className="text-small text-text-secondary hover:underline disabled:opacity-50"
                    >
                      {labels['admin.announcements.delete']}
                    </button>
                  ) : null}

                  {a.status !== 'published' ? (
                    <span className="text-xsmall text-text-secondary">
                      {labels['admin.announcements.publish_warning']}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
