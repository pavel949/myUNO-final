'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StayDatePicker } from '@/components/StayDatePicker';
import type { PlaceOption } from '@/lib/place-search';
import { PlaceCombobox, type PlaceComboboxLabels } from './PlaceCombobox';
import { useHomeIntent } from './HomeIntentProvider';
import { HOME_INTENTS, type HomeIntent } from './home-intent';
import { deviceClass, trackPublicInteraction } from '@/components/public-analytics';

export interface HomeFinderLabels {
  aria: string;
  mode: Record<HomeIntent, string>;
  cta: Record<HomeIntent, string>;
  place: PlaceComboboxLabels;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  datesError: string;
  moveIn: string;
  leaseTerm: string;
  pets: string;
  petOptions: { any: string; yes: string; no: string };
  filters: {
    more: string;
    type: string;
    any: string;
    villa: string;
    condo: string;
    bedrooms: string;
    budget: Record<HomeIntent, string>;
  };
  picker: { previous: string; next: string; close: string; clear: string };
}

/**
 * The homepage search. Three modes share one place field; switching mode keeps
 * what still applies (place, type, bedrooms, dates) and drops what does not
 * (a nightly budget is never carried over as a purchase budget).
 */
export function HomeFinder({
  labels,
  locale,
  places,
}: {
  labels: HomeFinderLabels;
  locale: string;
  places: PlaceOption[];
}) {
  const router = useRouter();
  const { intent, locale: activeLocale, destination, setIntent, place, setPlace, search, setSearch } = useHomeIntent();
  const { startDate, endDate, adults, children, unitType, bedrooms, budget, moveIn, leaseTermMonths, pets } = search;
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (intent === 'buy' || intent === 'monthly') {
      trackPublicInteraction('search_submitted', {
        destination,
        locale: activeLocale,
        intent,
        source: 'homepage',
        deviceClass: deviceClass(),
        projectId: place?.kind === 'project' ? place.id : undefined,
        areaId: place?.kind === 'area' ? place.id : undefined,
        hasDates: false,
      });
      const params = new URLSearchParams({ intent: intent === 'buy' ? 'buy' : 'rent' });
      if (place?.kind === 'area' && place.slug) params.set('area', place.slug);
      if (place?.kind === 'project') params.set('projectId', place.id);
      if (unitType) params.set('type', unitType);
      if (bedrooms) params.set('bedrooms', bedrooms);
      if (budget) params.set('maxPrice', budget);
      if (intent === 'monthly') {
        if (moveIn) params.set('moveIn', moveIn);
        if (leaseTermMonths) params.set('leaseTermMonths', leaseTermMonths);
        if (pets !== 'any') params.set('pets', pets);
      }
      router.push('/homes?' + params.toString());
      return;
    }

    if (!startDate || !endDate || startDate < today || endDate <= startDate) {
      setError(labels.datesError);
      return;
    }
    trackPublicInteraction('search_submitted', {
      destination,
      locale: activeLocale,
      intent,
      source: 'homepage',
      deviceClass: deviceClass(),
      projectId: place?.kind === 'project' ? place.id : undefined,
      areaId: place?.kind === 'area' ? place.id : undefined,
      hasDates: true,
    });
    const params = new URLSearchParams({
      startDate,
      endDate,
      adults: String(adults),
      children: String(children),
    });
    if (place?.kind === 'area' && place.slug) params.set('areaSlug', place.slug);
    if (place?.kind === 'project') params.set('projectId', place.id);
    if (unitType) params.set('unitTypes', unitType);
    if (bedrooms) params.set('bedrooms', bedrooms);
    if (budget) params.set('maxPrice', budget);
    router.push('/search?' + params.toString());
  }

  const field =
    'h-48 w-full rounded-lg border border-border-line bg-surface-ivory px-12 text-text-ink';

  return (
    <form
      onSubmit={submit}
      aria-label={labels.aria}
      className="rounded-2xl border border-border-line bg-surface-paper p-12 text-text-ink shadow-float md:p-16"
    >
      <div className="mb-12 grid grid-cols-3 gap-8" role="group" aria-label={labels.aria}>
        {HOME_INTENTS.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={intent === mode}
            onClick={() => {
              if (mode === intent) return;
              setIntent(mode);
              setError('');
            }}
            className={`min-h-44 rounded-full px-8 py-8 text-small font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
              intent === mode
                ? 'bg-brand-andaman text-white'
                : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'
            }`}
          >
            {labels.mode[mode]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:items-end">
        <PlaceCombobox
          options={places}
          value={place}
          onChange={setPlace}
          labels={labels.place}
          className={intent === 'stay' ? 'col-span-2 lg:col-span-1' : 'col-span-2 lg:col-span-4'}
        />

        {intent === 'stay' ? (
          <>
            <StayDatePicker
              start={startDate}
              end={endDate}
              min={today}
              locale={locale}
              labels={{
                checkIn: labels.checkIn,
                checkOut: labels.checkOut,
                ...labels.picker,
              }}
              onChange={(start, end) => {
                setSearch((current) => ({ ...current, startDate: start, endDate: end }));
                setError('');
              }}
            />
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.adults}
              <input
                className={field}
                type="number"
                required
                min="1"
                max="20"
                value={adults}
                onChange={(e) => setSearch((current) => ({ ...current, adults: Number(e.target.value) }))}
              />
            </label>
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.children}
              <input
                className={field}
                type="number"
                required
                min="0"
                max="20"
                value={children}
                onChange={(e) => setSearch((current) => ({ ...current, children: Number(e.target.value) }))}
              />
            </label>
          </>
        ) : null}

        {intent === 'monthly' ? (
          <>
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.moveIn}
              <input
                className={field}
                type="month"
                min={today.slice(0, 7)}
                value={moveIn}
                onChange={(e) => setSearch((current) => ({ ...current, moveIn: e.target.value }))}
              />
            </label>
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.leaseTerm}
              <select
                className={field}
                value={leaseTermMonths}
                onChange={(e) => setSearch((current) => ({ ...current, leaseTermMonths: e.target.value }))}
              >
                <option value="">{labels.filters.any}</option>
                {[1, 3, 6, 12, 24].map((months) => (
                  <option key={months} value={months}>{months}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <details className="col-span-2 rounded-lg border border-border-line bg-surface-ivory px-12 py-8 lg:col-span-4">
          <summary className="min-h-32 cursor-pointer text-small font-semibold text-brand-andaman focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman">
            {labels.filters.more}
          </summary>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.filters.type}
              <select className={field} value={unitType} onChange={(e) => setSearch((current) => ({ ...current, unitType: e.target.value }))}>
                <option value="">{labels.filters.any}</option>
                <option value="villa">{labels.filters.villa}</option>
                <option value="condo">{labels.filters.condo}</option>
              </select>
            </label>
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.filters.bedrooms}
              <select className={field} value={bedrooms} onChange={(e) => setSearch((current) => ({ ...current, bedrooms: e.target.value }))}>
                <option value="">{labels.filters.any}</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {intent === 'buy' ? '+' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-8 text-small text-text-secondary">
              {labels.filters.budget[intent]}
              <input
                type="number"
                min="0"
                step="100"
                value={budget}
                onChange={(e) => setSearch((current) => ({ ...current, budget: e.target.value }))}
                className={field}
              />
            </label>
            {intent === 'monthly' ? (
              <label className="grid gap-8 text-small text-text-secondary">
                {labels.pets}
                <select
                  className={field}
                  value={pets}
                  onChange={(e) => setSearch((current) => ({ ...current, pets: e.target.value as 'any' | 'yes' | 'no' }))}
                >
                  <option value="any">{labels.petOptions.any}</option>
                  <option value="yes">{labels.petOptions.yes}</option>
                  <option value="no">{labels.petOptions.no}</option>
                </select>
              </label>
            ) : null}
          </div>
        </details>

        <button
          type="submit"
          className="col-span-2 h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman lg:col-span-4"
        >
          {labels.cta[intent]} →
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-8 text-small text-state-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
