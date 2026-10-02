'use client';

import { useState } from 'react';
import { StayDatePicker } from './StayDatePicker';
import { useRouter } from 'next/navigation';

type Mode = 'rent' | 'buy' | 'manage' | 'sell';

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
    rent: string;
    buy: string;
    manage: string;
    sell: string;
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
  const [mode, setMode] = useState<Mode>('rent');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [unitType, setUnitType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budget, setBudget] = useState('');
  const [managementPath, setManagementPath] = useState('home');
  const copy = locale === 'ru' ? { type: 'Тип недвижимости', all: 'Любой', villa: 'Вилла', condo: 'Кондо', bedrooms: 'Спальни', budget: 'Бюджет до, ฿ / ночь', buyBudget: 'Бюджет покупки до, ฿', previous: 'Предыдущий месяц', next: 'Следующий месяц', close: 'Готово', clear: 'Сбросить', manage: 'Передайте объект в управление myUNO или подключите портфель управляющей компании.', home: 'Мой объект', portfolio: 'Портфель / компания', apply: 'Подать заявку на управление', sell: 'Добавьте объект для продажи: данные, фотографии и подтверждение полномочий.', sellCta: 'Добавить объект для продажи' } : locale === 'th' ? { type: 'ประเภทที่พัก', all: 'ทั้งหมด', villa: 'วิลล่า', condo: 'คอนโด', bedrooms: 'ห้องนอน', budget: 'งบสูงสุด ฿ / คืน', buyBudget: 'งบซื้อสูงสุด ฿', previous: 'เดือนก่อนหน้า', next: 'เดือนถัดไป', close: 'เสร็จสิ้น', clear: 'ล้าง', manage: 'สมัครให้ myUNO ดูแลที่พัก หรือเชื่อมต่อพอร์ตของบริษัทจัดการ', home: 'ที่พักของฉัน', portfolio: 'พอร์ต / บริษัท', apply: 'สมัครการจัดการ', sell: 'เพิ่มที่พักเพื่อขาย พร้อมรายละเอียด รูปภาพ และหลักฐานสิทธิ์', sellCta: 'เพิ่มที่พักเพื่อขาย' } : { type: 'Property type', all: 'Any', villa: 'Villa', condo: 'Condo', bedrooms: 'Bedrooms', budget: 'Budget up to, ฿ / night', buyBudget: 'Purchase budget up to, ฿', previous: 'Previous month', next: 'Next month', close: 'Done', clear: 'Clear', manage: 'Apply for myUNO property management or connect your management company portfolio.', home: 'My property', portfolio: 'Portfolio / company', apply: 'Apply for management', sell: 'Add a property for sale with its details, photos and listing authority.', sellCta: 'Add property for sale' };
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  const options: { id: Mode; title: string }[] = [
    { id: 'rent', title: labels.rent },
    { id: 'buy', title: labels.buy },
    { id: 'manage', title: labels.manage },
    { id: 'sell', title: labels.sell },
  ];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (mode === 'buy') {
      const params = new URLSearchParams({ intent: 'buy' });
      if (destination.startsWith('area:')) params.set('area', destination.slice(5));
      if (destination.startsWith('project:')) params.set('projectId', destination.slice(8));
      if (unitType) params.set('type', unitType);
      if (bedrooms) params.set('bedrooms', bedrooms);
      if (budget) params.set('maxPrice', budget);
      router.push('/homes?' + params.toString());
      return;
    }
    if (mode === 'manage') {
      router.push(managementPath === 'home' ? '/property/onboard?kind=home&operatingModel=direct_managed' : '/property/onboard?kind=project&operatingModel=via_management_company');
      return;
    }
    if (mode === 'sell') {
      router.push('/property/onboard?kind=home&offers=sale');
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
    if (destination.startsWith('project:')) {
      params.set('projectId', destination.slice('project:'.length));
    } else if (destination.startsWith('area:')) {
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
      className="rounded-2xl border border-white/10 bg-surface-paper p-12 text-text-ink shadow-float md:p-16"
      aria-label={labels.explore}
    >
      <div className="mb-12 grid grid-cols-4 gap-4" role="group" aria-label={labels.explore}>
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

      {mode === 'rent' || mode === 'buy' ? (
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:items-end">
          <label className="col-span-2 grid gap-8 text-small text-text-secondary lg:col-span-1">
            {labels.where}
            <select
              className="h-48 min-w-0 rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">{labels.allPhuket}</option>
              {areas.length ? (
                <optgroup label={labels.locations}>
                  {areas.map((area) => (
                    <option key={area.slug} value={`area:${area.slug}`}>{area.name}</option>
                  ))}
                </optgroup>
              ) : null}
              {projects.length ? (
                <optgroup label={labels.projects}>
                  {projects.map((project) => (
                    <option key={project.id} value={`project:${project.id}`}>{project.name}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>

          {mode === 'rent' && <StayDatePicker start={startDate} end={endDate} min={today} locale={locale} labels={{ checkIn: labels.checkIn, checkOut: labels.checkOut, ...copy }} onChange={(start, end) => { setStartDate(start); setEndDate(end); setError(''); }} />}

          {mode === 'rent' && <><label className="grid gap-8 text-small text-text-secondary">
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
          <label className="col-span-2 grid gap-8 text-small text-text-secondary">{mode === 'rent' ? copy.budget : copy.buyBudget}
            <input type="number" min="0" step="100" value={budget} onChange={e => setBudget(e.target.value)} className="h-48 w-full rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink" />
          </label>
          <button
            className="col-span-2 h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman lg:col-span-1"
            type="submit"
          >
            {labels.explore} →
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start justify-between gap-16 rounded-xl bg-surface-ivory px-16 py-16 md:flex-row md:items-center">
          <p className="max-w-2xl text-body text-text-secondary">{mode === 'manage' ? copy.manage : copy.sell}</p>
          {mode === 'manage' && <select aria-label={copy.manage} value={managementPath} onChange={e => setManagementPath(e.target.value)} className="h-48 w-full rounded-lg border border-border-line bg-surface-paper px-12 md:w-auto"><option value="home">{copy.home}</option><option value="portfolio">{copy.portfolio}</option></select>}
          <button
            type="submit"
            className="h-48 w-full shrink-0 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep md:w-auto"
          >
            {mode === 'manage' ? copy.apply : copy.sellCta} →
          </button>
        </div>
      )}

      {error ? <p role="alert" className="mt-8 text-small text-state-error">{error}</p> : null}
    </form>
  );
}
