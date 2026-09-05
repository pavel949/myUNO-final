'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';

interface QueueFiling {
  id: string;
  status: string;
  dueAt: string;
  guestName: string;
  nationality: string;
  unitName: string;
  projectName: string;
}

interface PassportDetails {
  guestName: string | null;
  nationality: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  unitName: string;
  projectName: string | null;
  addressBlock: string;
  portalUrl: string;
}

type Labels = Record<string, string>;

const receiptInputProps = {
  type: 'file' as const,
  accept: 'image/jpeg,image/png,image/webp',
};

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export default function Tm30FilingDetailDrawer({
  filing,
  labels,
  onClose,
  onComplete,
}: {
  filing: QueueFiling | null;
  labels: Labels;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [details, setDetails] = useState<PassportDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureNote, setFailureNote] = useState('');
  const [copied, setCopied] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const loadDetails = useCallback(async () => {
    if (!filing) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tm30/${filing.id}/passport`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.tm30.error_generic']);
      }
      setDetails(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tm30.error_generic']);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [filing, labels]);

  useEffect(() => {
    if (!filing) {
      setDetails(null);
      setError(null);
      setFailureNote('');
      setCopied(false);
      return;
    }
    void loadDetails();
  }, [filing, loadDetails]);

  if (!filing) {
    return null;
  }

  const uploadReceipt = async (file: File): Promise<string | undefined> => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'photo');
    const response = await fetch('/api/media/upload', { method: 'POST', body: form });
    if (!response.ok) {
      throw new Error(labels['staff.tm30.receipt_upload_error']);
    }
    const data = await response.json();
    return data.mediaAssetId as string;
  };

  const markFiled = async () => {
    if (
      !window.confirm(fill(labels['staff.tm30.file_confirm'], { guest: filing.guestName }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let receiptMediaId: string | undefined;
      const file = receiptInputRef.current?.files?.[0];
      if (file) {
        receiptMediaId = await uploadReceipt(file);
      }
      const response = await fetch(`/api/tm30/${filing.id}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptMediaId: receiptMediaId ?? null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.tm30.error_generic']);
      }
      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tm30.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const markFailed = async () => {
    const note = failureNote.trim();
    if (!note) {
      setError(labels['staff.tm30.fail_note_required']);
      return;
    }
    if (!window.confirm(labels['staff.tm30.fail_confirm'])) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tm30/${filing.id}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failureNote: note }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.tm30.error_generic']);
      }
      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tm30.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!details?.addressBlock) return;
    try {
      await navigator.clipboard.writeText(details.addressBlock);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(labels['staff.tm30.copy_error']);
    }
  };

  const title = fill(labels['staff.tm30.detail_title'], { guest: filing.guestName });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-16"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-paper border border-border-line rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-24">
        <div className="flex items-start justify-between gap-16 mb-16">
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink">{title}</h2>
            <p className="text-small text-text-secondary mt-8">
              {filing.unitName} · {filing.projectName} · {filing.nationality}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-small font-semibold text-text-secondary hover:text-text-ink"
          >
            {labels['staff.tm30.detail_close']}
          </button>
        </div>

        {error ? (
          <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
            <p className="text-small text-state-error">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="text-body text-text-secondary py-24">{labels['staff.tm30.detail_loading']}</p>
        ) : details ? (
          <>
            <section className="mb-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
                {labels['staff.tm30.passport_section']}
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-small">
                <div>
                  <dt className="text-text-secondary">{labels['staff.tm30.passport_name']}</dt>
                  <dd className="text-text-ink font-medium">{details.guestName || '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['staff.tm30.passport_nationality']}</dt>
                  <dd className="text-text-ink font-medium">{details.nationality || '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['staff.tm30.passport_number']}</dt>
                  <dd className="text-text-ink font-medium font-mono">
                    {details.passportNumber || labels['staff.tm30.passport_missing']}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['staff.tm30.passport_dob']}</dt>
                  <dd className="text-text-ink font-medium">{details.dateOfBirth || '—'}</dd>
                </div>
              </dl>
              <p className="text-small text-text-secondary mt-12 italic">
                {labels['staff.tm30.passport_access_logged']}
              </p>
            </section>

            <section className="mb-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
                {labels['staff.tm30.address_section']}
              </h3>
              <pre className="whitespace-pre-wrap text-small text-text-ink bg-surface-ivory border border-border-line rounded-lg p-16 font-sans">
                {details.addressBlock || '—'}
              </pre>
              <div className="flex flex-wrap gap-8 mt-12">
                <Button size="sm" variant="secondary" onClick={() => void copyAddress()}>
                  {copied ? labels['staff.tm30.address_copied'] : labels['staff.tm30.address_copy']}
                </Button>
                <a
                  href={details.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center h-40 px-16 rounded-sm border border-border-line text-small font-semibold text-brand-andaman hover:bg-brand-andaman-soft"
                >
                  {labels['staff.tm30.portal_link']}
                </a>
              </div>
            </section>

            <section className="mb-24 border-t border-border-line pt-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
                {labels['staff.tm30.file_section']}
              </h3>
              <p className="text-small text-text-secondary mb-12">
                {labels['staff.tm30.receipt_hint']}
              </p>
              <input
                ref={receiptInputRef}
                {...receiptInputProps}
                className="block w-full text-small text-text-secondary mb-16"
              />
              <Button onClick={() => void markFiled()} isLoading={busy}>
                {labels['staff.tm30.file_action']}
              </Button>
            </section>

            <section className="border-t border-border-line pt-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
                {labels['staff.tm30.fail_section']}
              </h3>
              <p className="text-small text-text-secondary mb-12">
                {labels['staff.tm30.fail_hint']}
              </p>
              <textarea
                value={failureNote}
                onChange={(event) => setFailureNote(event.target.value)}
                rows={3}
                className="w-full rounded-sm border border-border-line bg-surface-background px-12 py-8 text-body text-text-ink mb-12"
                placeholder={labels['staff.tm30.fail_note_placeholder']}
              />
              <Button variant="secondary" onClick={() => void markFailed()} isLoading={busy}>
                {labels['staff.tm30.fail_action']}
              </Button>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
