'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface CredentialRow {
  id: string;
  credentialType: string;
  scopeLevel: string;
  projectId: string | null;
  projectName: string | null;
  unitId: string | null;
  unitName: string | null;
  registrationNumber: string | null;
  issuingAuthority: string | null;
  expiryDate: string | null;
  status: string;
  evidenceMediaId: string | null;
}

type Labels = Record<string, string>;

const CREDENTIAL_TYPES = ['hotel_business_license', 'accommodation_exemption', 'title_legal_use'];

export default function RegulatoryCredentialsClient({
  labels,
  projects,
  units,
}: {
  labels: Labels;
  projects: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; projectId: string }>;
}) {
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    scopeLevel: 'project',
    projectId: '',
    unitId: '',
    credentialType: CREDENTIAL_TYPES[0],
    issuingAuthority: '',
    registrationNumber: '',
    expiryDate: '',
  });

  const credentialTypeLabel = (type: string) =>
    labels[`admin.compliance.credentials.type.${type}`] || type;
  const statusLabel = (status: string) =>
    labels[`admin.compliance.credentials.status.${status}`] || status;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/regulatory-credentials');
      if (!res.ok) throw new Error(labels['admin.compliance.credentials.error']);
      const data = await res.json();
      setCredentials(
        (data.credentials || []).map((raw: Record<string, unknown>) => ({
          id: String(raw.id),
          credentialType: String(raw.credentialType),
          scopeLevel: String(raw.scopeLevel),
          projectId: raw.projectId ? String(raw.projectId) : null,
          projectName: raw.projectName ? String(raw.projectName) : null,
          unitId: raw.unitId ? String(raw.unitId) : null,
          unitName: raw.unitName ? String(raw.unitName) : null,
          registrationNumber: raw.registrationNumber ? String(raw.registrationNumber) : null,
          issuingAuthority: raw.issuingAuthority ? String(raw.issuingAuthority) : null,
          expiryDate: raw.expiryDate ? String(raw.expiryDate) : null,
          status: String(raw.status),
          evidenceMediaId: raw.evidenceMediaId ? String(raw.evidenceMediaId) : null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.compliance.credentials.error']);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const unitsForProject = draft.projectId
    ? units.filter((u) => u.projectId === draft.projectId)
    : units;

  const create = async () => {
    if (draft.scopeLevel === 'project' && !draft.projectId) return;
    if (draft.scopeLevel === 'unit' && !draft.unitId) return;
    setBusyId('create');
    setError(null);
    try {
      let evidenceMediaId: string | undefined;
      if (evidenceFile) {
        const form = new FormData(); form.set('file', evidenceFile);
        const upload = await fetch('/api/admin/regulatory-credentials/evidence', { method: 'POST', body: form });
        const result = await upload.json().catch(() => null);
        if (!upload.ok || !result?.mediaAssetId) throw new Error(result?.error || labels['admin.compliance.credentials.evidence_failed']);
        evidenceMediaId = result.mediaAssetId;
      }
      const response = await fetch('/api/admin/regulatory-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeLevel: draft.scopeLevel,
          projectId: draft.scopeLevel === 'project' ? draft.projectId : undefined,
          unitId: draft.scopeLevel === 'unit' ? draft.unitId : undefined,
          credentialType: draft.credentialType,
          evidenceMediaId,
          issuingAuthority: draft.issuingAuthority || undefined,
          registrationNumber: draft.registrationNumber || undefined,
          expiryDate: draft.expiryDate || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.compliance.credentials.error']);
      }
      setDraft((prev) => ({
        ...prev,
        issuingAuthority: '',
        registrationNumber: '',
        expiryDate: '',
      }));
      setEvidenceFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.compliance.credentials.error']);
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/regulatory-credentials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.compliance.credentials.error']);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.compliance.credentials.error']);
    } finally {
      setBusyId(null);
    }
  };

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <select
          value={draft.scopeLevel}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, scopeLevel: e.target.value, projectId: '', unitId: '' }))
          }
          className={fieldClass}
        >
          <option value="project">{labels['admin.compliance.credentials.scope.project']}</option>
          <option value="unit">{labels['admin.compliance.credentials.scope.unit']}</option>
        </select>

        <select
          value={draft.projectId}
          onChange={(e) => setDraft((prev) => ({ ...prev, projectId: e.target.value, unitId: '' }))}
          className={fieldClass}
        >
          <option value="">{labels['admin.compliance.credentials.select_project']}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        {draft.scopeLevel === 'unit' && (
          <select
            value={draft.unitId}
            onChange={(e) => setDraft((prev) => ({ ...prev, unitId: e.target.value }))}
            className={fieldClass}
          >
            <option value="">{labels['admin.compliance.credentials.select_unit']}</option>
            {unitsForProject.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <select
          value={draft.credentialType}
          onChange={(e) => setDraft((prev) => ({ ...prev, credentialType: e.target.value }))}
          className={fieldClass}
        >
          {CREDENTIAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {credentialTypeLabel(type)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={draft.issuingAuthority}
          onChange={(e) => setDraft((prev) => ({ ...prev, issuingAuthority: e.target.value }))}
          placeholder={labels['admin.compliance.credentials.issuing_authority']}
          className={fieldClass}
        />
        <input
          type="text"
          value={draft.registrationNumber}
          onChange={(e) => setDraft((prev) => ({ ...prev, registrationNumber: e.target.value }))}
          placeholder={labels['admin.compliance.credentials.registration_number']}
          className={fieldClass}
        />
        <input
          type="date"
          value={draft.expiryDate}
          onChange={(e) => setDraft((prev) => ({ ...prev, expiryDate: e.target.value }))}
          className={fieldClass}
        />
      </div>

      <label className="mb-12 block text-small text-text-ink">
        {labels['admin.compliance.credentials.evidence']}
        <input className={fieldClass + ' mt-8'} type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={e => setEvidenceFile(e.currentTarget.files?.[0] || null)} />
      </label>
      <p className="mb-12 text-small text-text-secondary">{labels['admin.compliance.credentials.evidence_note']}</p>
      <Button size="sm" onClick={create} isLoading={busyId === 'create'}>
        {labels['admin.compliance.credentials.create_submit']}
      </Button>

      <div className="mt-24">
        {loading ? (
          <p className="text-body text-text-secondary">{labels['admin.compliance.credentials.loading']}</p>
        ) : credentials.length === 0 ? (
          <p className="text-body text-text-secondary">{labels['admin.compliance.credentials.empty']}</p>
        ) : (
          <div className="overflow-x-auto border border-border-line rounded-lg">
            <table className="w-full text-left text-small">
              <thead className="bg-surface-ivory border-b border-border-line">
                <tr>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_scope']}</th>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_type']}</th>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_authority']}</th>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_expiry']}</th>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_status']}</th>
                  <th className="p-12 font-semibold">{labels['admin.compliance.credentials.col_action']}</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((row) => (
                  <tr key={row.id} className="border-b border-border-line last:border-0">
                    <td className="p-12 text-text-ink">
                      {row.unitName || row.projectName || '—'}
                    </td>
                    <td className="p-12 text-text-secondary">{credentialTypeLabel(row.credentialType)}</td>
                    <td className="p-12 text-text-secondary">
                      {row.issuingAuthority || '—'}
                      {row.registrationNumber ? ` · ${row.registrationNumber}` : ''}
                    </td>
                    <td className="p-12 text-text-secondary">
                      {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-12 text-text-secondary">{statusLabel(row.status)}{row.evidenceMediaId && <a className="ml-8 text-brand-andaman underline" href={'/api/admin/regulatory-credentials/evidence?id=' + encodeURIComponent(row.evidenceMediaId)}>{labels['admin.compliance.credentials.view_evidence']}</a>}</td>
                    <td className="p-12">
                      {row.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          isLoading={busyId === row.id}
                          onClick={() => setStatus(row.id, 'revoked')}
                        >
                          {labels['admin.compliance.credentials.revoke']}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
