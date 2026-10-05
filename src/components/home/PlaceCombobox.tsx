'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { matchPlaces, type PlaceOption } from '@/lib/place-search';
import type { HomePlaceSelection } from './home-intent';

export interface PlaceComboboxLabels {
  label: string;
  placeholder: string;
  all: string;
  areas: string;
  complexes: string;
  empty: string;
  clear: string;
}

/**
 * One search box for areas and complexes (WAI-ARIA combobox with a listbox).
 * Choosing an option keeps it as a filter; the parent decides what it filters.
 */
export function PlaceCombobox({
  options,
  value,
  onChange,
  labels,
  className = 'col-span-2 lg:col-span-1',
}: {
  className?: string;
  options: PlaceOption[];
  value: HomePlaceSelection | null;
  onChange: (place: HomePlaceSelection | null) => void;
  labels: PlaceComboboxLabels;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => matchPlaces(options, query, 8), [options, query]);
  const shown = value && !open ? value.name : query;

  function choose(option: PlaceOption | null) {
    if (option) onChange({ kind: option.kind, id: option.id, slug: option.slug, name: option.name });
    else onChange(null);
    setQuery('');
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;
  const kindLabel = (kind: PlaceOption['kind']) => (kind === 'area' ? labels.areas : labels.complexes);

  return (
    <div className={`relative ${className}`}>
      <label className="grid gap-8 text-small text-text-secondary">
        {labels.label}
        <span className="relative block">
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
            autoComplete="off"
            value={shown}
            placeholder={open ? labels.placeholder : labels.all}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-48 w-full min-w-0 rounded-lg border border-border-line bg-surface-ivory px-12 pr-44 text-text-ink placeholder:text-text-ink"
          />
          {value ? (
            <button
              type="button"
              aria-label={labels.clear}
              onClick={() => {
                choose(null);
                input.current?.focus();
              }}
              className="absolute right-0 top-0 flex h-48 w-44 items-center justify-center text-text-secondary hover:text-text-ink"
            >
              ×
            </button>
          ) : null}
        </span>
      </label>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={labels.label}
          className="absolute left-0 right-0 top-full z-30 mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-border-line bg-surface-paper p-8 shadow-float"
        >
          {matches.length === 0 ? (
            <li role="presentation" className="px-12 py-12 text-small text-text-secondary">
              {labels.empty}
            </li>
          ) : (
            matches.map((option, index) => (
              <li
                key={`${option.kind}:${option.id}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-44 cursor-pointer items-center justify-between gap-12 rounded-lg px-12 py-8 text-body ${
                  index === active ? 'bg-surface-ivory text-brand-andaman' : 'text-text-ink'
                }`}
              >
                <span className="min-w-0 break-words">{option.name}</span>
                <span className="shrink-0 text-small text-text-secondary">{kindLabel(option.kind)}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
