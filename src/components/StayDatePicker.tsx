'use client';

import { useEffect, useRef, useState } from 'react';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parse = (value: string) => new Date(`${value}T12:00:00`);

export function StayDatePicker({ start, end, min, locale, labels, onChange }: {
  start: string; end: string; min: string; locale: string;
  labels: { checkIn: string; checkOut: string; previous: string; next: string; close: string; clear: string };
  onChange: (start: string, end: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [month, setMonth] = useState(() => parse(start || min));
  const [selectingEnd, setSelectingEnd] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const close = () => trigger.current?.focus();
    element.addEventListener('close', close);
    return () => element.removeEventListener('close', close);
  }, []);
  const format = (value: string) => value ? parse(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const previous = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  return <div className="col-span-2 grid gap-8 text-small text-text-secondary">
    <span>{labels.checkIn} — {labels.checkOut}</span>
    <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => {
      setMonth(parse(start || min)); setSelectingEnd(Boolean(start)); dialog.current?.showModal();
    }} className="h-48 rounded-lg border border-border-line bg-surface-ivory px-12 text-left text-text-ink focus-visible:outline-brand-andaman">
      {start ? format(start) : labels.checkIn} → {end ? format(end) : labels.checkOut}
    </button>
    <dialog ref={dialog} aria-label={`${labels.checkIn} — ${labels.checkOut}`} className="m-auto w-[calc(100%_-_24px)] max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl border border-border-line bg-surface-paper p-16 text-text-ink shadow-float backdrop:bg-brand-deep/50">
      <div className="flex items-center justify-between gap-8">
        <p className="font-semibold">{labels.checkIn} — {labels.checkOut}</p>
        <button type="button" aria-label={labels.close} onClick={() => dialog.current?.close()} className="min-h-44 min-w-44 rounded-full hover:bg-surface-ivory">×</button>
      </div>
      <p aria-live="polite" className="mb-12 text-small text-brand-andaman">{selectingEnd ? labels.checkOut : labels.checkIn}</p>
      <div className="flex items-center justify-between">
        <button type="button" aria-label={labels.previous} disabled={dateKey(new Date(previous.getFullYear(), previous.getMonth() + 1, 0)) < min} onClick={() => setMonth(previous)} className="min-h-44 min-w-44 rounded-full disabled:opacity-30">‹</button>
        <h3 aria-live="polite" className="font-semibold">{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h3>
        <button type="button" aria-label={labels.next} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="min-h-44 min-w-44 rounded-full">›</button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="py-8 text-small text-text-secondary">{new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' })}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const value = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const selected = value === start || value === end;
          return <button key={value} type="button" aria-label={parse(value).toLocaleDateString(locale, { dateStyle: 'full' })} aria-pressed={selected} disabled={value < min} onClick={() => {
            if (!selectingEnd || !start || value <= start) { onChange(value, ''); setSelectingEnd(true); }
            else { onChange(start, value); setSelectingEnd(false); dialog.current?.close(); }
          }} className={`min-h-44 rounded-lg text-small focus-visible:outline-2 focus-visible:outline-brand-andaman disabled:text-text-secondary disabled:opacity-30 ${selected ? 'bg-brand-andaman text-white' : start && end && value > start && value < end ? 'bg-surface-ivory text-brand-andaman' : 'hover:bg-surface-ivory'}`}>{i + 1}</button>;
        })}
      </div>
      <div className="mt-16 flex justify-between">
        <button type="button" onClick={() => { onChange('', ''); setSelectingEnd(false); }} className="min-h-44 px-12 text-brand-andaman">{labels.clear}</button>
        <button type="button" onClick={() => dialog.current?.close()} className="min-h-44 rounded-lg bg-brand-andaman px-16 text-white">{labels.close}</button>
      </div>
    </dialog>
  </div>;
}
