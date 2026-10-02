'use client';

import { useState } from 'react';
import { StayDatePicker } from './StayDatePicker';
import { useRouter } from 'next/navigation';

type Mode = 'stay' | 'monthly' | 'buy';

export interface DiscoveryProjectOption {
  id: string;
  name: string;
}

export interface DiscoveryAreaOption {
  slug: string;
  name: string;
}

export function DiscoverySearch({
  labels,
  locale = 'en',
  projects = [],
  areas = [],
}: {
  locale?: string;
  labels: {
    stay: string;
    monthly: string;
    buy: string;
    where: string;
    allPhuket: string;
    locations: string;
    projects: string;
    checkIn: string;
    checkOut: string;
    adults: string;
    children: string;
    explore: string;
    properties: string;
    hint: string;
    error: string;
  };
  projects?: DiscoveryProjectOption[];
  areas?: DiscoveryAreaOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('stay');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [unitType, setUnitType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budget, setBudget] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const copy = locale === 'ru'
    ? { type: 'Тип недвижимости', all: 'Любой', villa: 'Вилла', condo: 'Кондо', bedrooms: 'Спальни', budget: 'Бюджет до, ฿ / ночь', monthlyBudget: 'Бюджет до, ฿ / месяц', buyBudget: 'Бюджет покупки до, ฿', previous: 'Предыдущий месяц', next: 'Следующий месяц', close: 'Готово', clear: 'Сбросить', moreFilters: 'Больше фильтров' }
    : locale === 'th'
      ? { type: 'ประเภทที่พัก', all: 'ทั้งหมด', villa: 'วิลล่า', condo: 'คอนโด', bedrooms: 'ห้องนอน', budget: 'งบสูงสุด ฿ / คืน', monthlyBudget: 'งบสูงสุด ฿ / เดือน', buyBudget: 'งบซื้อสูงสุด ฿', previous: 'เดือนก่อนหน้า', next: 'เดือนถัดไป', close: 'เสร็จสิ้น', clear: 'ล้าง', moreFilters: 'ตัวกรองเพิ่มเติม' }
      : { type: 'Property type', all: 'Any', villa: 'Villa', condo: 'Condo', bedrooms: 'Bedrooms', budget: 'Budget up to, ฿ / night', monthlyBudget: 'Budget up to, ฿ / month', buyBudget: 'Purchase budget up to, ฿', previous: 'Previous month', next: 'Next month', close: 'Done', clear: 'Clear', moreFilters: 'More filters' };
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  const options: { id: Mode; title: string }[] = [
    { id: 'stay', title: labels.stay },
    { id: 'monthly', title: labels.monthly },
    { id: 'buy', title: labels.buy },
  ];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (mode === 'buy' || mode === 'monthly') {
      const params = new URLSearchParams({ intent: mode === 'buy' ? 'buy' : 'rent' });
      if (destination.startsWith('area:')) params.set('area', destination.slice(5));
      if (projectId) params.set('projectId', projectId);
      if (unitType) params.set('type', unitType);
      if (bedrooms) params.set('bedrooms', bedrooms);
      if (budget) params.set('maxPrice', budget);
      router.push('/homes?' + params.toString());
      return;
    }
    if (!startDate || !endDate || startDate < today || endDate <= startDate) {
      setError(labels.error);
      return;
    }

    const params = new URLSearchParams({
      startDate,
      endDate,
      adults: String(adults),
      children: String(children),
    });
    if (projectId) params.set('projectId', projectId);
    if (destination.startsWith('area:')) {
      params.set('areaSlug', destination.slice('area:'.length));
    }
    if (unitType) params.set('unitTypes', unitType);
    if (bedrooms) params.set('bedrooms', bedrooms);
    if (budget) params.set('maxPrice', budget);
    router.push('/search?' + params.toString());
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border-line bg-surface-paper p-12 text-text-ink shadow-float md:p-16"
      aria-label={labels.explore}
    >
      <div className="mb-12 grid grid-cols-3 gap-8" role="group" aria-label={labels.explore}>
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setBudget('');
              setError('');
            }}
            aria-pressed={mode === item.id}
            className={`min-h-44 rounded-full px-8 py-8 text-small font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
              mode === item.id
                ? 'bg-brand-andaman text-white'
                : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:items-end">

          <label className="col-span-2 grid gap-8 text-small text-text-secondary lg:col-span-1">
            {labels.where}
            <select
              className="h-48 min-w-0 rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink"
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setProjectId(''); }}
            >
              <option value="">{labels.allPhuket}</option>
              {areas.length ? (
                <optgroup label={labels.locations}>
                  {areas.map((area) => (
                    <option key={area.slug} value={`area:${area.slug}`}>{area.name}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>

          {projects.length > 0 && <details className="col-span-2 min-w-0 rounded-lg border border-border-line bg-surface-ivory px-12 py-8">
            <summary className="min-h-32 cursor-pointer break-words text-small font-semibold text-brand-andaman">{labels.projects}{projectId ? ` · ${projects.find(p => p.id === projectId)?.name || ''}` : ''}</summary>
            <input aria-label={labels.projects} type="search" value={projectQuery} onChange={e => setProjectQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} placeholder={labels.projects} className="mt-8 h-44 w-full rounded-lg border border-border-line bg-surface-paper px-12 text-text-ink" />
            <div className="mt-8 flex max-h-[160px] flex-wrap gap-8 overflow-y-auto overscroll-contain">
              <button type="button" aria-pressed={!projectId} onClick={() => setProjectId('')} className={`min-h-44 max-w-full break-words rounded-full border px-12 py-8 text-left text-small ${!projectId ? 'border-brand-andaman bg-brand-andaman text-white' : 'border-border-line bg-surface-paper'}`}>{copy.all}</button>
              {projects.filter(p => p.name.toLocaleLowerCase(locale).includes(projectQuery.toLocaleLowerCase(locale))).map(project => <button key={project.id} type="button" aria-pressed={projectId === project.id} onClick={() => { setProjectId(project.id); setDestination(''); }} className={`min-h-44 max-w-full break-words rounded-full border px-12 py-8 text-left text-small ${projectId === project.id ? 'border-brand-andaman bg-brand-andaman text-white' : 'border-border-line bg-surface-paper'}`}>{project.name}</button>)}
            </div>
          </details>}
          {mode === 'stay' && <StayDatePicker start={startDate} end={endDate} min={today} locale={locale} labels={{ checkIn: labels.checkIn, checkOut: labels.checkOut, ...copy }} onChange={(start, end) => { setStartDate(start); setEndDate(end); setError(''); }} />}

          {mode === 'stay' && <><label className="grid gap-8 text-small text-text-secondary">
            {labels.adults}
            <input
              className="h-48 w-full rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink"
              type="number"
              required
              min="1"
              max="20"
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-8 text-small text-text-secondary">
            {labels.children}
            <input
              className="h-48 w-full rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink"
              type="number"
              required
              min="0"
              max="20"
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
            />
          </label>

          </>}
          <details className="col-span-2 rounded-lg border border-border-line bg-surface-ivory px-12 py-8 lg:col-span-4">
            <summary className="min-h-32 cursor-pointer text-small font-semibold text-brand-andaman focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman">
              {copy.moreFilters}
            </summary>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              <label className="grid gap-8 text-small text-text-secondary">{copy.type}
                <select className="h-48 rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink" value={unitType} onChange={e => setUnitType(e.target.value)}>
                  <option value="">{copy.all}</option><option value="villa">{copy.villa}</option><option value="condo">{copy.condo}</option>
                </select>
              </label>
              <label className="grid gap-8 text-small text-text-secondary">{copy.bedrooms}
                <select className="h-48 rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink" value={bedrooms} onChange={e => setBedrooms(e.target.value)}>
                  <option value="">{copy.all}</option>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}{mode === 'buy' ? '+' : ''}</option>)}
                </select>
              </label>
              <label className="grid gap-8 text-small text-text-secondary">{mode === 'stay' ? copy.budget : mode === 'monthly' ? copy.monthlyBudget : copy.buyBudget}
                <input type="number" min="0" step="100" value={budget} onChange={e => setBudget(e.target.value)} className="h-48 w-full rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink" />
              </label>
            </div>
          </details>
          <button
            className="col-span-2 h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman lg:col-span-1"
            type="submit"
          >
            {labels.explore} →
          </button>
      </div>

      {error ? <p role="alert" className="mt-8 text-small text-state-error">{error}</p> : null}
    </form>
  );
}
