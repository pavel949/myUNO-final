'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * The seven steps of doc 07 F-OWN-1, each with the action it needs.
 *
 * The step order is the gate's order, and the server enforces it — this screen
 * does not re-implement that rule, it just shows the result. A step refused by
 * `checkMobilizationGate` surfaces the server's reason rather than a guess made
 * here, so there is one place the sequence is decided.
 */

interface StepRow {
  step: string;
  itemId: string | null;
  status: string | null;
  notes: string | null;
  completedAt: string | null;
}

interface Engagement {
  id: string;
  engagementType: string;
  status: string;
  noiCapAnnualThb: number | null;
}

interface ComplianceRow {
  id: string;
  recordType: string;
  status: string;
  label: string | null;
  expiresOn: string | null;
}

type Labels = Record<string, string>;

const ENGAGEMENT_TYPES = ['direct_managed', 'via_management_company', 'owner_direct'];
const RECORD_TYPES = ['permitted_use', 'insurance', 'license', 'title_audit', 'other'];

export default function OnboardingClient({
  unitId,
  labels,
  steps,
  owner,
  engagements,
  complianceRecords,
  permittedUseConfirmed,
}: {
  unitId: string;
  labels: Labels;
  steps: StepRow[];
  owner: { id: string; name: string } | null;
  engagements: Engagement[];
  complianceRecords: ComplianceRow[];
  permittedUseConfirmed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key);
    setError(null);
    try {
      const response = await fn();
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        // The server's reason, not a generic failure — a blocked gate explains
        // itself, and replacing that with "action failed" hides the one useful
        // sentence.
        throw new Error(data?.error || labels['admin.onboarding.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.onboarding.error_generic']);
    } finally {
      setBusy(null);
    }
  };

  const hasChecklist = steps.some((s) => s.itemId);
  const hasPermittedUseRecord = complianceRecords.some((r) => r.recordType === 'permitted_use');

  const post = (url: string, body?: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

  return (
    <div className="space-y-32">
      {error && (
        <div className="bg-state-error/10 border border-state-error rounded-lg p-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      {/* Owner — a mandate cannot exist without one, so it comes first. */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.onboarding.owner_title']}
        </h2>
        {owner ? (
          <p className="text-body text-text-ink mb-16">{owner.name}</p>
        ) : (
          <p className="text-body text-state-warning mb-16">
            {labels['admin.onboarding.owner_none']}
          </p>
        )}
        <form
          className="flex flex-wrap gap-12 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget as HTMLFormElement);
            const email = String(form.get('email') || '').trim();
            if (!email) return;
            act('owner', async () => {
              const found = await fetch(
                `/api/admin/people/search?q=${encodeURIComponent(email)}`
              ).then((r) => r.json());
              const identity = found?.identities?.[0];
              if (!identity) throw new Error('No identity found for that email');
              return fetch(`/api/admin/units/${unitId}/owner`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerIdentityId: identity.id }),
              });
            });
          }}
        >
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.owner_email']}
            <input
              name="email"
              type="email"
              required
              className="block h-40 w-64 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <Button type="submit" disabled={busy === 'owner'}>
            {busy === 'owner' ? labels['admin.onboarding.saving'] : labels['admin.onboarding.owner_set']}
          </Button>
        </form>
      </section>

      {/* Mandate — the step that decides whether statements can ever run. */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.onboarding.engagement_title']}
        </h2>
        {engagements.length === 0 ? (
          <p className="text-body text-state-warning mb-16">
            {labels['admin.onboarding.engagement_none']}
          </p>
        ) : (
          <ul className="mb-16 space-y-8">
            {engagements.map((e) => (
              <li key={e.id} className="text-body text-text-ink">
                {e.engagementType} · {e.status}
                {e.noiCapAnnualThb !== null && ` · ฿${e.noiCapAnnualThb.toLocaleString()}`}
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap gap-12 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget as HTMLFormElement);
            const noiCap = String(form.get('noiCap') || '').trim();
            act('engagement', () =>
              post(`/api/admin/units/${unitId}/engagement`, {
                engagementType: form.get('engagementType'),
                // Sent only when given: the service requires it for
                // direct-managed and must be allowed to say so.
                noiCapAnnualThb: noiCap ? Number(noiCap) : undefined,
              })
            );
          }}
        >
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.engagement_type']}
            <select
              name="engagementType"
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            >
              {ENGAGEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.noi_cap']}
            <input
              name="noiCap"
              type="number"
              min="0"
              className="block h-40 w-48 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
            <span className="block text-small text-text-secondary mt-4 max-w-xs">
              {labels['admin.onboarding.noi_cap_hint']}
            </span>
          </label>
          <Button type="submit" disabled={busy === 'engagement'}>
            {busy === 'engagement'
              ? labels['admin.onboarding.saving']
              : labels['admin.onboarding.record_engagement']}
          </Button>
        </form>
      </section>

      {/* Compliance — the evidence behind the permitted-use gate. */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.onboarding.compliance_title']}
        </h2>
        {permittedUseConfirmed && !hasPermittedUseRecord && (
          <p className="text-body text-state-warning mb-16">
            {labels['admin.onboarding.permitted_use_warning']}
          </p>
        )}
        {complianceRecords.length === 0 ? (
          <p className="text-body text-text-secondary mb-16">
            {labels['admin.onboarding.compliance_none']}
          </p>
        ) : (
          <ul className="mb-16 space-y-8">
            {complianceRecords.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-12 text-body text-text-ink">
                <span className="flex-1 min-w-32">
                  {r.recordType} · {r.status}
                  {r.label && ` · ${r.label}`}
                  {r.expiresOn && ` · ${r.expiresOn.slice(0, 10)}`}
                </span>
                {/* Attaching a document and attesting to it are two acts, and
                    go-live wants the second one. */}
                {r.status !== 'confirmed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === r.id}
                    onClick={() =>
                      act(r.id, () =>
                        fetch(`/api/admin/units/${unitId}/compliance/${r.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'confirmed' }),
                        })
                      )
                    }
                  >
                    {busy === r.id
                      ? labels['admin.onboarding.saving']
                      : labels['admin.onboarding.confirm_record']}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap gap-12 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget as HTMLFormElement);
            const expires = String(form.get('expiresOn') || '').trim();
            act('compliance', () =>
              post(`/api/admin/units/${unitId}/compliance`, {
                recordType: form.get('recordType'),
                label: String(form.get('label') || '').trim() || undefined,
                expiresOn: expires || undefined,
              })
            );
          }}
        >
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.record_type']}
            <select
              name="recordType"
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            >
              {RECORD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.label']}
            <input
              name="label"
              className="block h-40 w-64 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['admin.onboarding.expires']}
            <input
              name="expiresOn"
              type="date"
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <Button type="submit" disabled={busy === 'compliance'}>
            {busy === 'compliance'
              ? labels['admin.onboarding.saving']
              : labels['admin.onboarding.add_record']}
          </Button>
        </form>
      </section>

      {/* The checklist itself. */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['admin.onboarding.title']}
        </h2>

        {!hasChecklist && (
          <div className="mb-16">
            <p className="text-body text-text-secondary mb-12">
              {labels['admin.onboarding.no_checklist']}
            </p>
            <Button
              onClick={() => act('init', () => post(`/api/admin/units/${unitId}/mobilization`))}
              disabled={busy === 'init'}
            >
              {busy === 'init'
                ? labels['admin.onboarding.saving']
                : labels['admin.onboarding.start_checklist']}
            </Button>
          </div>
        )}

        <ol className="space-y-12">
          {steps.map((row, index) => (
            <li
              key={row.step}
              className="flex flex-wrap items-center gap-12 border-b border-border-line pb-12 last:border-0"
            >
              <span className="text-small text-text-secondary w-16">{index + 1}</span>
              <span className="text-body text-text-ink flex-1 min-w-32">{row.step}</span>
              <span className="text-small text-text-secondary">
                {row.status === 'done'
                  ? labels['admin.onboarding.done']
                  : row.status === 'blocked'
                    ? labels['admin.onboarding.blocked']
                    : row.status
                      ? labels['admin.onboarding.pending']
                      : '—'}
              </span>
              {row.itemId && row.status !== 'done' && (
                <Button
                  onClick={() =>
                    act(row.step, () =>
                      post(`/api/admin/units/${unitId}/mobilization/${row.itemId}`)
                    )
                  }
                  disabled={busy === row.step}
                >
                  {busy === row.step
                    ? labels['admin.onboarding.saving']
                    : labels['admin.onboarding.complete_step']}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
