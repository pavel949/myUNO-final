'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useEffect, useRef, useState } from 'react';

export interface ResolvedProjectPlace {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  postcode?: string | null;
}

type Suggestion = {
  placeId: string;
  text: string;
  name: string;
  secondaryText: string;
};

export function ProjectPlaceAutocomplete({
  value,
  onChange,
  onSelect,
  inputClassName,
  label = 'Property name',
  placeholder = 'Start typing the complex name',
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: ResolvedProjectPlace) => void;
  inputClassName: string;
  label?: string;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [resolving, setResolving] = useState(false);
  const sessionRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  );

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/geo/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: query, sessionToken: sessionRef.current }),
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const payload = await response.json();
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSuggestions([]);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = async (suggestion: Suggestion) => {
    setResolving(true);
    setLookupError('');
    try {
      const response = await fetch('/api/geo/places/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: sessionRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not resolve this place.');

      onChange(suggestion.name || suggestion.text);
      onSelect({
        ...payload,
        name: suggestion.name || suggestion.text,
      });
      setSuggestions([]);
      setOpen(false);
      sessionRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now());
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Could not resolve this place.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-small text-text-secondary">
        {label}
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setLookupError('');
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClassName}
        />
      </label>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-border-line bg-surface-paper shadow-card">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              disabled={resolving}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className="block w-full border-b border-border-line px-14 py-12 text-left last:border-b-0 hover:bg-surface-ivory disabled:opacity-50"
            >
              <span className="block text-body font-semibold text-text-ink">
                {suggestion.name || suggestion.text}
              </span>
              {suggestion.secondaryText && (
                <span className="mt-2 block text-small text-text-secondary">
                  {suggestion.secondaryText}
                </span>
              )}
            </button>
          ))}
          <div className="px-14 py-8 text-right text-[11px] text-text-secondary">
            Google Maps
          </div>
        </div>
      )}

      {lookupError && <p className="mt-4 text-small text-state-error">{lookupError}</p>}
    </div>
  );
}
