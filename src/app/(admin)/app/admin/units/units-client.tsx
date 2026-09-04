'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';

interface AdminUnit {
  id: string;
  name: string;
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
  units,
  labels,
}: {
  units: AdminUnit[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const act = async (unitId: string, fn: () => Promise<Response>) => {
    setBusyId(unitId);
    setError(null);
    try {
      const response = await fn();
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.units.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.units.error_generic']);
    } finally {
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
      })
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
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChosen}
      />
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
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
            <p className="text-small text-text-secondary">
              {labels['admin.units.owner']}: {unit.ownerName} · {labels['admin.units.price']}: ฿
              {unit.baseNightlyThb.toLocaleString()} · {labels['admin.units.status']}:{' '}
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
              >
                {labels['admin.units.confirm_action']}
              </Button>
            )}
            {unit.status !== 'live' ? (
              <Button
                size="sm"
                onClick={() => setStatus(unit.id, 'live')}
                isLoading={busyId === unit.id}
                disabled={!unit.permittedUseConfirmed}
              >
                {labels['admin.units.set_live']}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStatus(unit.id, 'paused')}
                isLoading={busyId === unit.id}
              >
                {labels['admin.units.pause']}
              </Button>
            )}
            <select
              value={unit.assetStatus}
              onChange={(e) => setAssetStatus(unit.id, e.target.value)}
              disabled={busyId === unit.id}
              className="h-36 px-8 rounded-sm border border-border-line text-small text-text-ink bg-surface-paper"
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
            >
              {labels['admin.units.upload_photo']}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
