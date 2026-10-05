'use client';

import { useCallback, useEffect, useState } from 'react';

type Project = { id: string; name: string };
type Assignment = {
  id: string; identityId: string; grantedByIdentityId: string | null; canRevoke: boolean;
  identity: { firstName: string; lastName: string; email: string | null; status: string };
};

export default function ProjectTeamClient({ projects, labels }: { projects: Project[]; labels: Record<string, string> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [email, setEmail] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ops/team?projectId=' + encodeURIComponent(projectId), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load project team');
      setAssignments(data.assignments || []);
    } catch (e) {
      setAssignments([]);
      setError(e instanceof Error ? e.message : 'Could not load project team');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const assign = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/ops/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not assign user');
      setEmail(''); setNotice(labels['ops.team.assigned']);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not assign user'); setLoading(false); }
  };

  const revoke = async (assignmentId: string) => {
    setLoading(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/ops/team', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, assignmentId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not revoke access');
      setNotice(labels['ops.team.revoked']); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke access'); setLoading(false); }
  };

  return <section className="mt-24 stitch-panel p-24">
    <label className="block text-small font-semibold text-text-ink" htmlFor="team-project">{labels['ops.team.project']}</label>
    <select id="team-project" value={projectId} onChange={e => setProjectId(e.target.value)}
      className="mt-8 w-full rounded-lg border border-border-line bg-surface-ivory p-12">
      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    <form onSubmit={assign} className="mt-24 flex flex-col gap-8 md:flex-row">
      <label className="flex-1 text-small font-semibold text-text-ink" htmlFor="team-email">
        {labels['ops.team.email']}
        <input id="team-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="mt-8 w-full rounded-lg border border-border-line bg-surface-ivory p-12"
          placeholder="colleague@example.com" />
      </label>
      <button disabled={loading || !projectId || !email} className="rounded-lg bg-brand-andaman px-20 py-12 text-white disabled:opacity-50">{labels['ops.team.assign']}</button>
    </form>
    <p className="mt-8 text-small text-text-secondary">{labels['ops.team.invite_note']}</p>
    {error && <p role="alert" className="mt-12 text-state-error">{error}</p>}
    {notice && <p role="status" className="mt-12 text-text-ink">{notice}</p>}
    <h2 className="mt-24 font-semibold">{labels['ops.team.members']}</h2>
    {loading && <p className="mt-8 text-text-secondary">{labels['ops.team.loading']}</p>}
    {!loading && !assignments.length && !error && <p className="mt-8 text-text-secondary">{labels['ops.team.empty']}</p>}
    <ul className="mt-12 divide-y divide-border-line">
      {assignments.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-12 py-12">
        <div><p className="font-semibold">{a.identity.firstName} {a.identity.lastName}</p>
        <p className="text-small text-text-secondary">{a.identity.email} · {a.identity.status}</p></div>
        {a.canRevoke ? <button disabled={loading} type="button" onClick={() => void revoke(a.id)}
          className="rounded-lg border border-border-line px-12 py-8 text-small disabled:opacity-50">{labels['ops.team.revoke']}</button>
          : <span className="text-small text-text-secondary">{labels['ops.team.admin_managed']}</span>}
      </li>)}
    </ul>
  </section>;
}
