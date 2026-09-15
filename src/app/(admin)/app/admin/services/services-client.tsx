'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { satangToBaht } from '@/lib/money';

interface AdminService {
  id: string;
  title: string;
  providerName: string;
  status: string;
  categoryKey: string;
  priceModel: string;
  basePriceThb: number | null;
  durationMin: number | null;
  advanceNoticeHours: number;
  titleEn: string | null;
  titleRu: string | null;
  titleTh: string | null;
  descriptionEn: string | null;
  descriptionRu: string | null;
  descriptionTh: string | null;
  createdAt: string;
}

type Labels = Record<string, string>;

const statusStyle: Record<string, string> = {
  draft: 'bg-state-warning-soft text-state-warning',
  active: 'bg-state-success-soft text-state-success',
  paused: 'bg-surface-ivory text-text-secondary',
  vetted: 'bg-state-success-soft text-state-success',
  rejected: 'bg-state-error-soft text-state-error',
};

/** The editable copy and commercial fields, as the form holds them. */
interface EditDraft {
  titleEn: string;
  titleRu: string;
  titleTh: string;
  descriptionEn: string;
  descriptionRu: string;
  descriptionTh: string;
  price: string;
  duration: string;
  notice: string;
}

function draftOf(service: AdminService): EditDraft {
  return {
    titleEn: service.titleEn ?? service.title ?? '',
    titleRu: service.titleRu ?? '',
    titleTh: service.titleTh ?? '',
    descriptionEn: service.descriptionEn ?? '',
    descriptionRu: service.descriptionRu ?? '',
    descriptionTh: service.descriptionTh ?? '',
    // The field asks for baht; the row holds satang. One conversion here and
    // one back on save — the pair the money module owns.
    price: service.basePriceThb != null ? String(satangToBaht(service.basePriceThb)) : '',
    duration: service.durationMin != null ? String(service.durationMin) : '',
    notice: String(service.advanceNoticeHours ?? 0),
  };
}

const FILTERS = ['all', 'draft', 'active', 'paused'] as const;
type Filter = (typeof FILTERS)[number];

export default function ServicesAdminClient({
  services,
  labels,
}: {
  services: AdminService[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditDraft | null>(null);

  const act = async (serviceId: string, body: Record<string, unknown>) => {
    setBusyId(serviceId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.services.error_generic']);
      }
      setEditingId(null);
      setEdit(null);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.services.error_generic']);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = (service: AdminService) => {
    if (!edit) return;
    const body: Record<string, unknown> = {
      action: 'edit',
      titleEn: edit.titleEn,
      titleRu: edit.titleRu,
      titleTh: edit.titleTh,
      descriptionEn: edit.descriptionEn,
      descriptionRu: edit.descriptionRu,
      descriptionTh: edit.descriptionTh,
    };
    // Commercial fields only where the server will accept them, so the form
    // never offers an action the server is going to reject.
    if (service.status !== 'active') {
      if (edit.price) body.basePriceThb = Math.round(Number(edit.price) * 100);
      if (edit.duration) body.durationMin = Number(edit.duration);
      if (edit.notice) body.advanceNoticeHours = Number(edit.notice);
    }
    void act(service.id, body);
  };

  const shown = services.filter((s) => filter === 'all' || s.status === filter);

  const field = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    long = false
  ) => (
    <label className="flex flex-col gap-4">
      <span className="text-small text-text-secondary">{label}</span>
      {long ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
        />
      )}
    </label>
  );

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-8 mb-16">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={`px-12 py-8 rounded-full text-small transition-colors duration-micro ${
              filter === option
                ? 'bg-brand-andaman text-on-dark-text'
                : 'bg-surface-ivory text-text-ink hover:bg-border-line'
            }`}
          >
            {labels[`admin.services.filter_${option}`] || option}
          </button>
        ))}
        <span className="text-small text-text-secondary ml-auto">
          {(labels['admin.services.count'] || '{count}').replace('{count}', String(shown.length))}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-body text-text-secondary py-16">{labels['admin.services.empty']}</p>
      ) : (
        shown.map((service) => (
          <div
            key={service.id}
            className="py-16 border-b border-border-line last:border-b-0"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-12">
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-text-ink">
                  {service.title}
                  <span className="text-text-secondary font-normal"> · {service.providerName}</span>
                </p>
                <p className="text-small text-text-secondary">
                  {labels[`services.category.${service.categoryKey}`] || service.categoryKey}
                  {' · '}
                  {labels[`admin.services.price_model.${service.priceModel}`] || service.priceModel}
                  {' · '}
                  {new Date(service.createdAt).toLocaleDateString()}
                </p>
              </div>

              <span
                className={`self-start px-12 py-4 rounded-full text-small font-semibold shrink-0 ${
                  statusStyle[service.status] || 'bg-surface-ivory text-text-ink'
                }`}
              >
                {labels[`admin.services.status_${service.status}`] || service.status}
              </span>

              <div className="flex flex-wrap items-center gap-8">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const opening = editingId !== service.id;
                    setEditingId(opening ? service.id : null);
                    setEdit(opening ? draftOf(service) : null);
                  }}
                >
                  {editingId === service.id
                    ? labels['admin.services.edit_cancel']
                    : labels['admin.services.edit']}
                </Button>

                {service.status === 'active' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => act(service.id, { action: 'pause' })}
                    isLoading={busyId === service.id}
                  >
                    {labels['admin.services.pause']}
                  </Button>
                )}
                {service.status === 'paused' && (
                  <Button
                    size="sm"
                    variant="sun"
                    onClick={() => act(service.id, { action: 'activate' })}
                    isLoading={busyId === service.id}
                  >
                    {labels['admin.services.activate']}
                  </Button>
                )}

                {service.status === 'draft' && (
                  <>
                    <Button
                      size="sm"
                      variant="sun"
                      onClick={() => act(service.id, { action: 'approve' })}
                      isLoading={busyId === service.id}
                    >
                      {labels['admin.services.approve']}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const reason = (rejectionReasons[service.id] || '').trim();
                        if (!reason) {
                          setError(labels['admin.services.reason_placeholder']);
                          return;
                        }
                        act(service.id, { action: 'reject', reason });
                      }}
                      isLoading={busyId === service.id}
                    >
                      {labels['admin.services.reject']}
                    </Button>
                    <input
                      type="text"
                      value={rejectionReasons[service.id] || ''}
                      onChange={(e) =>
                        setRejectionReasons((prev) => ({ ...prev, [service.id]: e.target.value }))
                      }
                      placeholder={labels['admin.services.reason_placeholder']}
                      className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-field-lg"
                    />
                  </>
                )}
              </div>
            </div>

            {editingId === service.id && edit && (
              <div className="mt-16 bg-surface-ivory rounded-md p-16 flex flex-col gap-12">
                <div className="grid gap-12 md:grid-cols-3">
                  {field(labels['admin.services.field_title_en'], edit.titleEn, (v) =>
                    setEdit({ ...edit, titleEn: v })
                  )}
                  {field(labels['admin.services.field_title_ru'], edit.titleRu, (v) =>
                    setEdit({ ...edit, titleRu: v })
                  )}
                  {field(labels['admin.services.field_title_th'], edit.titleTh, (v) =>
                    setEdit({ ...edit, titleTh: v })
                  )}
                </div>
                <div className="grid gap-12 md:grid-cols-3">
                  {field(
                    labels['admin.services.field_description_en'],
                    edit.descriptionEn,
                    (v) => setEdit({ ...edit, descriptionEn: v }),
                    true
                  )}
                  {field(
                    labels['admin.services.field_description_ru'],
                    edit.descriptionRu,
                    (v) => setEdit({ ...edit, descriptionRu: v }),
                    true
                  )}
                  {field(
                    labels['admin.services.field_description_th'],
                    edit.descriptionTh,
                    (v) => setEdit({ ...edit, descriptionTh: v }),
                    true
                  )}
                </div>

                {service.status === 'active' ? (
                  <p className="text-small text-text-secondary">
                    {labels['admin.services.locked_hint']}
                  </p>
                ) : (
                  <div className="grid gap-12 md:grid-cols-3">
                    {field(labels['admin.services.field_price'], edit.price, (v) =>
                      setEdit({ ...edit, price: v })
                    )}
                    {field(labels['admin.services.field_duration'], edit.duration, (v) =>
                      setEdit({ ...edit, duration: v })
                    )}
                    {field(labels['admin.services.field_notice'], edit.notice, (v) =>
                      setEdit({ ...edit, notice: v })
                    )}
                  </div>
                )}

                <div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => saveEdit(service)}
                    isLoading={busyId === service.id}
                  >
                    {busyId === service.id
                      ? labels['admin.services.edit_saving']
                      : labels['admin.services.edit_save']}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
