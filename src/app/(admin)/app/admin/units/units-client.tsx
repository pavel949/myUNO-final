'use client';


import { UI_LOCALE } from '@/lib/format';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';

interface AdminUnit {
  id: string;
  name: string;
  categoryName: string | null;
  projectName: string;
  status: string;
  assetStatus: string;
  baseNightlyThb: number;
  permittedUseConfirmed: boolean;
  coverUrl: string | null;
  ownerName: string;
}

type Labels = Record<string, string>;

export default function UnitsAdminClient({
  units: initialUnits,
  labels,
}: {
  units: AdminUnit[];
  labels: Labels;
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
  useEffect(() => { setUnits(initialUnits); }, [initialUnits]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ unitId: string; message: string } | null>(null);
  const actionPending = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const act = async (
    unitId: string,
    fn: () => Promise<Response>,
    expectedStatus?: 'live' | 'paused',
  ) => {
    // Lock synchronously as well as disabling controls after React renders.
    if (actionPending.current) return;
    actionPending.current = true;
    setBusyId(unitId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fn();
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.units.error_generic']);
      }
      if (expectedStatus) {
        const saved = await response.json().catch(() => null);
        if (saved?.id !== unitId || saved?.status !== expectedStatus) {
          throw new Error(labels['admin.units.error_generic']);
        }
        const name = units.find(unit => unit.id === unitId)?.name ?? unitId;
        const key = expectedStatus === 'live' ? 'publish_saved' : 'pause_saved';
        // The server has confirmed this exact transition. Keep the feedback
        // and review link mounted while reflecting its persisted row status.
        setUnits(current => current.map(unit => unit.id === unitId
          ? { ...unit, status: expectedStatus } : unit));
        setSuccess({
          unitId,
          message: labels[`admin.unit_publication.${key}`].replace('{name}', name),
        });
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.units.error_generic']);
    } finally {
      actionPending.current = false;
      setBusyId(null);
    }
  };

  const confirmPermittedUse = (unitId: string) =>
    act(unitId, () =>
      fetch(`/api/admin/units/${unitId}/confirm-permitted-use`, { method: 'POST' })
    );

  const setStatus = (unitId: string, status: 'live' | 'paused') =>
    act(unitId, () =>
      fetch(`/api/admin/units/${unitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
      status,
    );

  const setAssetStatus = (unitId: string, assetStatus: string) => {
    const reason = window.prompt(labels['admin.units.asset_status_reason']);
    if (!reason?.trim()) return;
    act(unitId, () =>
      fetch(`/api/admin/units/${unitId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: assetStatus, reason: reason.trim() }),
      })
    );
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const unitId = uploadTarget;
    event.target.value = '';
    if (!file || !unitId) return;

    await act(unitId, async () => {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'photo');
      const uploadResponse = await fetch('/api/media/upload', { method: 'POST', body: form });
      if (!uploadResponse.ok) return uploadResponse;
      const { mediaAssetId } = await uploadResponse.json();
      return fetch(`/api/admin/units/${unitId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaAssetId, cover: true }),
      });
    });
  };

  return (
    <div className="stitch-panel p-24">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChosen}
      />
      {error && (
        <div role="alert" className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}
      {success && (
        <div role="status" className="bg-state-success-soft border border-state-success rounded-lg p-16 mb-16">
          <p className="text-body text-text-ink">{success.message}</p>
          <a href={`/app/admin/units/${encodeURIComponent(success.unitId)}`} className="mt-8 inline-block text-small font-semibold text-brand-andaman hover:underline">
            {labels['admin.unit_publication.review_status']} →
          </a>
        </div>
      )}
      {units.map((unit) => (
        <div
          key={unit.id}
          className="flex flex-col lg:flex-row lg:items-center gap-16 py-16 border-b border-border-line last:border-b-0"
        >
          {unit.coverUrl ? (
            <Image
              src={unit.coverUrl}
              alt={unit.name}
              width={72}
              height={48}
              className="rounded-md object-cover shrink-0"
            />
          ) : (
            <div
              className="rounded-md bg-gradient-to-br from-brand-andaman to-brand-deep shrink-0"
              style={{ width: '72px', height: '48px' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold text-text-ink">
              <Link href={`/app/admin/units/${unit.id}`} className="hover:underline">
                {unit.name}
              </Link>
              <span className="text-text-secondary font-normal"> · {unit.projectName}</span>
            </p>
            <p className="text-small font-medium text-brand-andaman">{labels['admin.units.category']}: {unit.categoryName || labels['admin.units.no_category']}</p>
            <p className="text-small text-text-secondary">
              {labels['admin.units.owner']}: {unit.ownerName} · {labels['admin.units.price']}: ฿
              {unit.baseNightlyThb.toLocaleString(UI_LOCALE)} · {labels['admin.units.status']}:{' '}
              <span className="font-semibold text-text-ink">{unit.status}</span>
              {' · '}
              {labels['admin.units.permitted_use']}:{' '}
              {unit.permittedUseConfirmed ? (
                <span className="text-state-success font-semibold">
                  {labels['admin.units.confirmed']}
                </span>
              ) : (
                <span className="text-state-warning font-semibold">—</span>
              )}
              {' · '}
              {labels['admin.units.asset_status']}:{' '}
              <span className="font-semibold text-text-ink">
                {labels[`admin.units.asset_status.${unit.assetStatus}`] || unit.assetStatus}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            {!unit.permittedUseConfirmed && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => confirmPermittedUse(unit.id)}
                isLoading={busyId === unit.id}
                disabled={busyId !== null}
              >
                {labels['admin.units.confirm_action']}
              </Button>
            )}
            {unit.status !== 'live' ? (
              <Button
                size="sm"
                onClick={() => setStatus(unit.id, 'live')}
                isLoading={busyId === unit.id}
                disabled={busyId !== null || !unit.permittedUseConfirmed}
              >
                {labels['admin.units.set_live']}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStatus(unit.id, 'paused')}
                isLoading={busyId === unit.id}
                disabled={busyId !== null}
              >
                {labels['admin.units.pause']}
              </Button>
            )}
            <select
              value={unit.assetStatus}
              onChange={(e) => setAssetStatus(unit.id, e.target.value)}
              disabled={busyId !== null}
              className="h-40 px-8 rounded-sm border border-border-line text-small text-text-ink bg-surface-paper"
              aria-label={labels['admin.units.asset_status']}
            >
              <option value="managed">{labels['admin.units.asset_status.managed']}</option>
              <option value="verified_partner">
                {labels['admin.units.asset_status.verified_partner']}
              </option>
              <option value="one_off_sourced">
                {labels['admin.units.asset_status.one_off_sourced']}
              </option>
              <option value="suspended">{labels['admin.units.asset_status.suspended']}</option>
            </select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setUploadTarget(unit.id);
                fileInputRef.current?.click();
              }}
              isLoading={busyId === unit.id}
              disabled={busyId !== null}
            >
              {labels['admin.units.upload_photo']}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

