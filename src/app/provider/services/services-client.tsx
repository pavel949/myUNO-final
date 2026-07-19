'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface ProviderService {
  id: string;
  categoryKey: string;
  title: string;
  description: string | null;
  priceModel: string;
  basePriceThb: number | null;
  durationMin: number | null;
  advanceNoticeHours: number;
  status: string;
}

type Labels = Record<string, string>;

const PRICE_MODELS = ['fixed', 'per_hour', 'per_person', 'quote'];

const STATUS_TONE: Record<string, string> = {
  draft: 'text-state-warning',
  active: 'text-state-success',
  paused: 'text-text-secondary',
};

export default function ProviderServicesClient({
  services,
  categories,
  labels,
}: {
  services: ProviderService[];
  categories: { key: string; label: string }[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create-form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key || '');
  const [priceModel, setPriceModel] = useState('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [notice, setNotice] = useState('');

  // Edit-form state (drafts only)
  const [edit, setEdit] = useState<{
    title: string;
    price: string;
    duration: string;
    notice: string;
  }>({ title: '', price: '', duration: '', notice: '' });

  const inputClass =
    'w-full h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none';

  const request = async (path: string, method: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['provider.services.error_generic']);
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels['provider.services.error_generic']
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await request('/api/provider/services', 'POST', {
      title,
      description: description || undefined,
      categoryKey,
      priceModel,
      basePriceThb: priceModel === 'quote' ? undefined : Number(price),
      durationMin: duration ? Number(duration) : undefined,
      advanceNoticeHours: notice ? Number(notice) : undefined,
    });
    if (ok) {
      setTitle('');
      setDescription('');
      setPrice('');
      setDuration('');
      setNotice('');
    }
  };

  const startEdit = (service: ProviderService) => {
    setEditingId(service.id);
    setEdit({
      title: service.title,
      price: service.basePriceThb != null ? String(service.basePriceThb) : '',
      duration: service.durationMin != null ? String(service.durationMin) : '',
      notice: String(service.advanceNoticeHours),
    });
  };

  const saveEdit = async (serviceId: string) => {
    const ok = await request(`/api/provider/services/${serviceId}`, 'PATCH', {
      title: edit.title,
      ...(edit.price ? { basePriceThb: Number(edit.price) } : {}),
      ...(edit.duration ? { durationMin: Number(edit.duration) } : {}),
      ...(edit.notice ? { advanceNoticeHours: Number(edit.notice) } : {}),
    });
    if (ok) {
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-24">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-8">
          {labels['provider.services.title']}
        </h2>
        {services.length === 0 ? (
          <p className="text-body text-text-secondary py-8">
            {labels['provider.services.empty']}
          </p>
        ) : (
          services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
            >
              {editingId === service.id ? (
                <div className="flex-1 grid md:grid-cols-4 gap-8">
                  <input
                    className={inputClass}
                    value={edit.title}
                    onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))}
                    placeholder={labels['provider.services.field_title']}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    value={edit.price}
                    onChange={(e) => setEdit((p) => ({ ...p, price: e.target.value }))}
                    placeholder={labels['provider.services.field_price']}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    value={edit.duration}
                    onChange={(e) => setEdit((p) => ({ ...p, duration: e.target.value }))}
                    placeholder={labels['provider.services.field_duration']}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    value={edit.notice}
                    onChange={(e) => setEdit((p) => ({ ...p, notice: e.target.value }))}
                    placeholder={labels['provider.services.field_notice']}
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold text-text-ink">
                    {service.title}
                    <span
                      className={`font-normal ${STATUS_TONE[service.status] || 'text-text-secondary'}`}
                    >
                      {' '}
                      · {labels[`service.status.${service.status}`] || service.status}
                    </span>
                  </p>
                  <p className="text-small text-text-secondary">
                    {labels[`services.category.${service.categoryKey}`] || service.categoryKey}
                    {' · '}
                    {labels[`provider.services.price_model.${service.priceModel}`] ||
                      service.priceModel}
                    {service.basePriceThb != null &&
                      ` · ฿${service.basePriceThb.toLocaleString()}`}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-8">
                {service.status === 'draft' &&
                  (editingId === service.id ? (
                    <Button size="sm" onClick={() => saveEdit(service.id)} isLoading={busy}>
                      {labels['provider.services.save']}
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => startEdit(service)}>
                      {labels['provider.services.edit']}
                    </Button>
                  ))}
              </div>
            </div>
          ))
        )}
      </section>

      <form
        onSubmit={create}
        className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-12"
      >
        <div>
          <h2 className="text-heading-3 font-bold text-text-ink mb-4">
            {labels['provider.services.new_title']}
          </h2>
          <p className="text-small text-text-secondary">
            {labels['provider.services.draft_note']}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_title']}
            </span>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_category']}
            </span>
            <select
              className={inputClass}
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['provider.services.field_description']}
          </span>
          <textarea
            className="w-full px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="grid md:grid-cols-4 gap-12">
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_price_model']}
            </span>
            <select
              className={inputClass}
              value={priceModel}
              onChange={(e) => setPriceModel(e.target.value)}
            >
              {PRICE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {labels[`provider.services.price_model.${model}`] || model}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_price']}
            </span>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required={priceModel !== 'quote'}
              disabled={priceModel === 'quote'}
            />
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_duration']}
            </span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['provider.services.field_notice']}
            </span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
            />
          </label>
        </div>

        <div>
          <Button type="submit" isLoading={busy}>
            {labels['provider.services.create']}
          </Button>
        </div>
      </form>
    </div>
  );
}
