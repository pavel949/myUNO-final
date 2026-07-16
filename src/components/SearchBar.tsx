'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';

export interface SearchBarLabels {
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  submit: string;
}

interface SearchBarProps {
  labels: SearchBarLabels;
  initialStartDate?: string;
  initialEndDate?: string;
  initialAdults?: number;
  initialChildren?: number;
}

export function SearchBar({
  labels,
  initialStartDate = '',
  initialEndDate = '',
  initialAdults = 2,
  initialChildren = 0,
}: SearchBarProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [todayISO, setTodayISO] = useState('');

  // Set today's date only on client to avoid hydration mismatch
  useEffect(() => {
    setTodayISO(new Date().toISOString().slice(0, 10));
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!startDate || !endDate) return;
    const params = new URLSearchParams({
      startDate,
      endDate,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/search?${params.toString()}`);
  };

  const fieldClass =
    'h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink ' +
    'focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none w-full';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-paper rounded-lg p-16 shadow-float grid grid-cols-2 md:grid-cols-5 gap-12 items-end text-left"
    >
      <div className="flex flex-col gap-4">
        <label htmlFor="search-start" className="text-small text-text-secondary">
          {labels.checkIn}
        </label>
        <input
          id="search-start"
          type="date"
          required
          min={todayISO}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-4">
        <label htmlFor="search-end" className="text-small text-text-secondary">
          {labels.checkOut}
        </label>
        <input
          id="search-end"
          type="date"
          required
          min={startDate || todayISO}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={fieldClass}
        />
      </div>
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
