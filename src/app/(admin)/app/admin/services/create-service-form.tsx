'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Labels = Record<string, string>;

const PRICE_MODELS = ['fixed', 'per_hour', 'per_person', 'quote'];

export default function CreateServiceForm({
  providers,
  categories,
  labels,
}: {
  providers: { id: string; name: string }[];
  categories: { key: string; label: string }[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [providerId, setProviderId] = useState(providers[0]?.id || '');
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key || '');
  const [titleEn, setTitleEn] = useState('');
  const [titleRu, setTitleRu] = useState('');
  const [titleTh, setTitleTh] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionRu, setDescriptionRu] = useState('');
  const [descriptionTh, setDescriptionTh] = useState('');
  const [priceModel, setPriceModel] = useState('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [notice, setNotice] = useState('');

  const inputClass =
    'w-full h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none';
  const textareaClass =
    'w-full px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          categoryKey,
          titleEn,
          titleRu,
          titleTh: titleTh || undefined,
          descriptionEn: descriptionEn || undefined,
          descriptionRu: descriptionRu || undefined,
          descriptionTh: descriptionTh || undefined,
          priceModel,
          // The field asks for baht, matching every other money input in the
          // platform; the API and every stored Service row are satang
          // (CLAUDE.md money rules) — convert once, here, on the way out.
          basePriceThb: priceModel === 'quote' ? undefined : Math.round(Number(price) * 100),
          durationMin: duration ? Number(duration) : undefined,
          advanceNoticeHours: notice ? Number(notice) : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.services.error_generic']);
      }
      setSuccess(true);
      setTitleEn('');
      setTitleRu('');
      setTitleTh('');
      setDescriptionEn('');
      setDescriptionRu('');
      setDescriptionTh('');
      setPrice('');
      setDuration('');
      setNotice('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.services.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  if (providers.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-8">
          {labels['admin.services.create_title']}
        </h2>
        <p className="text-body text-text-secondary">{labels['admin.services.provider_empty']}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24 flex flex-col gap-12"
    >
      <div>
        <h2 className="text-heading-3 font-bold text-text-ink mb-4">
          {labels['admin.services.create_title']}
        </h2>
        <p className="text-small text-text-secondary">
          {labels['admin.services.create_subtitle']}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_provider']}
          </span>
          <select
            className={inputClass}
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_category']}
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

      <div className="grid md:grid-cols-3 gap-12">
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_title_en']}
          </span>
          <input
            className={inputClass}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_title_ru']}
          </span>
          <input
            className={inputClass}
            value={titleRu}
            onChange={(e) => setTitleRu(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_title_th']}
          </span>
          <input className={inputClass} value={titleTh} onChange={(e) => setTitleTh(e.target.value)} />
        </label>
      </div>

      <div className="grid md:grid-cols-3 gap-12">
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_description_en']}
          </span>
          <textarea
            className={textareaClass}
            rows={3}
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_description_ru']}
          </span>
          <textarea
            className={textareaClass}
            rows={3}
            value={descriptionRu}
            onChange={(e) => setDescriptionRu(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_description_th']}
          </span>
          <textarea
            className={textareaClass}
            rows={3}
            value={descriptionTh}
            onChange={(e) => setDescriptionTh(e.target.value)}
          />
        </label>
      </div>

      <div className="grid md:grid-cols-4 gap-12">
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_price_model']}
          </span>
          <select
            className={inputClass}
            value={priceModel}
            onChange={(e) => setPriceModel(e.target.value)}
          >
            {PRICE_MODELS.map((model) => (
              <option key={model} value={model}>
                {labels[`admin.services.price_model.${model}`] || model}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_price']}
          </span>
          <input
            className={inputClass}
            type="number"
            min={1}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required={priceModel !== 'quote'}
            disabled={priceModel === 'quote'}
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['admin.services.field_duration']}
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
            {labels['admin.services.field_notice']}
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

      {error && (
        <p className="text-small text-state-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-small text-state-success">{labels['admin.services.create_success']}</p>
      )}

      <div>
        <Button type="submit" isLoading={busy}>
          {busy ? labels['admin.services.create_working'] : labels['admin.services.create_submit']}
        </Button>
      </div>
    </form>
  );
}
