'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { ProjectPlaceAutocomplete } from '@/components/ProjectPlaceAutocomplete';
import { MyUNOMap } from '@/components/MyUNOMap';
import { MyUNOMap } from '@/components/MyUNOMap';
import type { MapEntity } from '@/modules/map';

type PlaceSuggestion = {
  placeId: string;
  name: string;
  secondaryText: string | null;
  fullText: string;
  types: string[];
};

export default function NewPropertyClient({ areas }: { areas: Array<{ id: string; slug: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [country, setCountry] = useState('TH');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `myuno-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const field = 'block h-40 w-full mt-4 rounded-sm border border-border-line px-12 bg-surface-paper';

  useEffect(() => {
    const query = name.trim();

    // A selected place stays canonical until the operator changes the name.
    if (googlePlaceId && query) return;
    if (query.length < 3) {
      setSuggestions([]);
      setPlaceOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceBusy(true);
      try {
        const params = new URLSearchParams({
          input: query,
          sessionToken: sessionTokenRef.current,
        });
        const response = await fetch('/api/admin/map/places/autocomplete?' + params.toString(), {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Place search failed.');
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setPlaceOpen(true);
      } catch (reason) {
        if ((reason as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setPlaceBusy(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [name, googlePlaceId]);

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    setPlaceBusy(true);
    setPlaceOpen(false);
    setError(null);

    try {
      const params = new URLSearchParams({
        placeId: suggestion.placeId,
        sessionToken: sessionTokenRef.current,
      });
      const response = await fetch('/api/admin/map/places/details?' + params.toString());
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load place location.');

      setName(suggestion.name);
      setGooglePlaceId(suggestion.placeId);
      setAddress(payload.address || suggestion.secondaryText || suggestion.fullText || '');
      setLatitude(String(payload.latitude));
      setLongitude(String(payload.longitude));
      setSuggestions([]);

      // A selection finishes one Places autocomplete billing session.
      sessionTokenRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `myuno-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load place location.');
    } finally {
      setPlaceBusy(false);
    }
  };

  const mapEntities = useMemo<MapEntity[]>(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [
      {
        id: 'project-preview',
        kind: 'project',
        title: name || 'Project location',
        subtitle: address || 'Selected location',
        latitude: lat,
        longitude: lng,
        href: '#',
        badge: 'Project',
      },
    ];
  }, [latitude, longitude, name, address]);

  return <main className="max-w-5xl">
    <p className="text-kicker text-brand-andaman mb-8">Property onboarding · 1/10</p>
    <h1 className="font-display text-display-xl font-semibold mb-8">Add a property</h1>
    <p className="text-body text-text-secondary mb-24">
      Start typing the English project or complex name. myUNO will suggest matching Phuket places and can fill the canonical address and coordinates automatically.
    </p>

    {error ? <p role="alert" className="p-12 mb-16 bg-state-error-soft text-state-error rounded-md">{error}</p> : null}

    <form
      className="grid grid-cols-1 md:grid-cols-3 gap-16 bg-surface-paper border border-border-line rounded-lg p-24"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const plusCode = String(data.get('plusCode') || '').trim();

        setBusy(true);
        setError(null);

        try {
          if (!plusCode && (!latitude.trim() || !longitude.trim())) {
            throw new Error('Choose a map suggestion, enter a Plus Code, or enter both coordinates.');
          }

          const response = await fetch('/api/admin/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: data.get('slug'),
              name,
              brand: data.get('brand') || undefined,
              address,
              areaId: data.get('areaId'),
              projectType: data.get('projectType'),
              country: data.get('country') || 'TH',
              city: data.get('city') || undefined,
              district: data.get('district') || undefined,
              googlePlaceId: googlePlaceId || undefined,
              plusCode: plusCode || undefined,
              ...(!plusCode ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
              areaLabelKey: `project.${data.get('slug')}.area`,
              descriptionKey: `project.${data.get('slug')}.description`,
              handbookKey: `project.${data.get('slug')}.handbook`,
              status: 'draft',
            }),
          });

          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Could not create property.');
          router.push(`/app/admin/properties/${payload.id}/onboarding`);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Could not create property.');
          setBusy(false);
        }
      }}
    >
      <div className="relative md:col-span-2">
        <label className="text-small text-text-secondary">
          Property / project name in English
          <input
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setGooglePlaceId('');
            }}
            onFocus={() => suggestions.length > 0 && setPlaceOpen(true)}
            autoComplete="off"
            required
            className={field}
            placeholder="e.g. The Title Legendary"
          />
        </label>

        {placeBusy && (
          <p className="mt-4 text-small text-text-secondary">Searching Phuket places…</p>
        )}

        {placeOpen && suggestions.length > 0 && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-border-line bg-surface-paper shadow-card">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className="block w-full border-b border-border-line px-14 py-12 text-left last:border-b-0 hover:bg-surface-ivory"
              >
                <span className="block text-body font-semibold text-text-ink">{suggestion.name}</span>
                {suggestion.secondaryText ? (
                  <span className="mt-2 block text-small text-text-secondary">{suggestion.secondaryText}</span>
                ) : null}
              </button>
            ))}
            <div className="px-14 py-8 text-right text-[11px] text-text-secondary">
              Powered by Google
            </div>
          </div>
        )}

        {googlePlaceId ? (
          <p className="mt-4 text-small text-state-success">
            Google place matched. Address and coordinates were filled automatically.
          </p>
        ) : null}
      </div>

      <TextField label="URL slug" name="slug" field={field} required />
      <TextField label="Brand" name="brand" field={field} />

      <label className="text-small text-text-secondary">
        Property type
        <select name="projectType" className={field}>
          <option value="resort">Resort</option>
          <option value="condominium">Condominium</option>
          <option value="villa_estate">Villa estate</option>
          <option value="standalone">Standalone</option>
        </select>
      </label>

      <label className="text-small text-text-secondary">
        Canonical area
        <select name="areaId" required defaultValue="" className={field}>
          <option value="" disabled>Select area</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.slug}</option>)}
        </select>
      </label>

      <label className="text-small text-text-secondary md:col-span-2">
        Full address
        <input
          name="address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className={field}
          required
        />
      </label>

      <TextField label="Country" name="country" field={field} defaultValue="TH" required />
      <TextField label="City" name="city" field={field} />
      <TextField label="District" name="district" field={field} />
      <TextField label="Plus Code" name="plusCode" field={field} placeholder="Optional override" />

      <label className="text-small text-text-secondary">
        Latitude
        <input
          name="latitude"
          type="number"
          step="any"
          value={latitude}
          onChange={(event) => setLatitude(event.target.value)}
          className={field}
        />
      </label>

      <label className="text-small text-text-secondary">
        Longitude
        <input
          name="longitude"
          type="number"
          step="any"
          value={longitude}
          onChange={(event) => setLongitude(event.target.value)}
          className={field}
        />
      </label>

      <input type="hidden" name="googlePlaceId" value={googlePlaceId} />

      {mapEntities.length > 0 ? (
        <div className="md:col-span-3">
          <p className="mb-8 text-small font-semibold text-text-ink">Map preview</p>
          <MyUNOMap entities={mapEntities} className="h-[360px] min-h-[360px]" selectedId="project-preview" />
        </div>
      ) : null}

      <div className="md:col-span-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create and continue'}
        </Button>
      </div>
    </form>
  </main>;
}

function TextField({ label, field, ...props }: { label: string; field: string; name: string; [key: string]: unknown }) {
  return <label className="text-small text-text-secondary">{label}<input className={field} {...props} /></label>;
}
