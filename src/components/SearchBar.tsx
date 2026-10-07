'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from './Button';
import { StayDatePicker } from './StayDatePicker';
import { useLocale } from './LocaleProvider';

export interface SearchBarLabels {
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  submit: string;
  previous?: string;
  next?: string;
  close?: string;
  clear?: string;
}

interface SearchBarProps {
  labels: SearchBarLabels;
  initialStartDate?: string;
  initialEndDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  /** Scope the search to one project — a landing's "check availability"
   *  must never return other resorts' homes (LY-5 bugfix). */
  projectId?: string;
  areaSlug?: string;
  stayMode?: string;
}

const PICKER_FALLBACKS: Record<string, { previous: string; next: string; close: string; clear: string }> = {
  ru: { previous: 'Назад', next: 'Вперёд', close: 'Закрыть', clear: 'Очистить' },
  th: { previous: 'ก่อนหน้า', next: 'ถัดไป', close: 'ปิด', clear: 'ล้าง' },
  zh: { previous: '上个月', next: '下个月', close: '关闭', clear: '清除' },
  en: { previous: 'Previous', next: 'Next', close: 'Close', clear: 'Clear' },
};

export function SearchBar({
  labels,
  initialStartDate = '',
  initialEndDate = '',
  initialAdults = 2,
  initialChildren = 0,
  projectId,
  areaSlug,
  stayMode,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [todayISO, setTodayISO] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  );

  // Set today's date only on client to avoid hydration mismatch.
  useEffect(() => {
    setTodayISO(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if ((startDate || endDate) && (!startDate || !endDate || endDate <= startDate)) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('adults', String(adults));
    params.set('children', String(children));
    if (projectId) params.set('projectId', projectId);
    if (areaSlug) params.set('areaSlug', areaSlug);
    if (stayMode) params.set('stayMode', stayMode);
    router.push(`/search?${params.toString()}`);
  };

  const fieldClass =
    'h-48 px-12 rounded-lg bg-surface-ivory border border-border-line text-text-ink ' +
    'focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none w-full';

  const language = locale.toLowerCase().split('-')[0];
  const fallback = PICKER_FALLBACKS[language] || PICKER_FALLBACKS.en;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 items-end gap-12 rounded-lg border border-border-line bg-surface-paper p-16 text-left shadow-float md:grid-cols-5"
    >
      <StayDatePicker
        start={startDate}
        end={endDate}
        min={todayISO}
        locale={locale}
        labels={{
          checkIn: labels.checkIn,
          checkOut: labels.checkOut,
          previous: labels.previous || fallback.previous,
          next: labels.next || fallback.next,
          close: labels.close || fallback.close,
          clear: labels.clear || fallback.clear,
        }}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />
      <div className="flex flex-col gap-4">
        <label htmlFor="search-adults" className="text-small text-text-secondary">
          {labels.adults}
        </label>
        <input
          id="search-adults"
          type="number"
          min={1}
          max={20}
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-4">
        <label htmlFor="search-children" className="text-small text-text-secondary">
          {labels.children}
        </label>
        <input
          id="search-children"
          type="number"
          min={0}
          max={20}
          value={children}
          onChange={(e) => setChildren(Number(e.target.value))}
          className={fieldClass}
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <Button type="submit" fullWidth>
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
