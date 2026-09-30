'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import {
  ProjectPlaceAutocomplete,
  type ResolvedProjectPlace,
} from '@/components/ProjectPlaceAutocomplete';
import { MyUNOMap } from '@/components/MyUNOMap';
import type { MapEntity } from '@/modules/map';

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
  const [region, setRegion] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [postcode, setPostcode] = useState('');

  const field = 'block h-40 w-full mt-4 rounded-sm border border-border-line px-12 bg-surface-paper';

  const applyPlace = (place: ResolvedProjectPlace) => {
    setGooglePlaceId(place.placeId);
    setAddress(place.address || '');
    setLatitude(String(place.latitude));
    setLongitude(String(place.longitude));
    setCountry(place.country === 'Thailand' || !place.country ? 'TH' : place.country);
    setRegion(place.region || '');
    setCity(place.city || '');
    setDistrict(place.district || '');
    setSubdistrict(place.subdistrict || '');
    setPostcode(place.postcode || '');
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

  return (
    <main className="max-w-5xl">
      <p className="text-kicker text-brand-andaman mb-8">Property onboarding · 1/10</p>
      <h1 className="font-display text-display-xl font-semibold mb-8">Add a property</h1>
      <p className="text-body text-text-secondary mb-24">
        Start typing the English project or complex name. myUNO searches Phuket places and can fill the canonical address and coordinates automatically.
      </p>

      {error ? (
        <p role="alert" className="p-12 mb-16 bg-state-error-soft text-state-error rounded-md">
          {error}
        </p>
      ) : null}

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
                country: country || 'TH',
                region: region || undefined,
                city: city || undefined,
                district: district || undefined,
                subdistrict: subdistrict || undefined,
                postcode: postcode || undefined,
                googlePlaceId: googlePlaceId || undefined,
                plusCode: plusCode || undefined,
                ...(!plusCode
                  ? { latitude: Number(latitude), longitude: Number(longitude) }
                  : {}),
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
        <div className="md:col-span-2">
          <ProjectPlaceAutocomplete
            value={name}
            onChange={(value) => {
              setName(value);
              if (googlePlaceId) setGooglePlaceId('');
            }}
            onSelect={applyPlace}
            inputClassName={field}
            label="Property / project name in English"
            placeholder="e.g. The Title Legendary"
          />
          {googlePlaceId ? (
            <p className="mt-4 text-small text-state-success">
              Place matched. Address and map position were filled automatically.
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
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.slug}
              </option>
            ))}
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

        <label className="text-small text-text-secondary">
          Country
          <input
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className={field}
            required
          />
        </label>

        <label className="text-small text-text-secondary">
          Region / province
          <input
            name="region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className={field}
          />
        </label>

        <label className="text-small text-text-secondary">
          City
          <input
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={field}
          />
        </label>

        <label className="text-small text-text-secondary">
          District
          <input
            name="district"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            className={field}
          />
        </label>

        <label className="text-small text-text-secondary">
          Subdistrict
          <input
            name="subdistrict"
            value={subdistrict}
            onChange={(event) => setSubdistrict(event.target.value)}
            className={field}
          />
        </label>

        <label className="text-small text-text-secondary">
          Postcode
          <input
            name="postcode"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            className={field}
          />
        </label>

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
            <MyUNOMap
              entities={mapEntities}
              className="h-[360px] min-h-[360px]"
              selectedId="project-preview"
            />
          </div>
        ) : null}

        <div className="md:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create and continue'}
          </Button>
        </div>
      </form>
    </main>
  );
}

function TextField({
  label,
  field,
  ...props
}: {
  label: string;
  field: string;
  name: string;
  [key: string]: unknown;
}) {
  return (
    <label className="text-small text-text-secondary">
      {label}
      <input className={field} {...props} />
    </label>
  );
}
