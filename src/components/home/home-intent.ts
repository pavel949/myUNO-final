/**
 * Pure homepage intent helpers. Deliberately NOT a 'use client' module: the
 * server-rendered homepage calls parseHomeIntent(), and a function exported
 * from a client module reaches server code as a client reference, not a
 * function ("g is not a function" in production).
 */

export type HomeIntent = 'stay' | 'monthly' | 'buy';

export const HOME_INTENTS: readonly HomeIntent[] = ['stay', 'monthly', 'buy'];

export function parseHomeIntent(value: string | null | undefined): HomeIntent {
  return value === 'monthly' || value === 'buy' ? value : 'stay';
}

export interface HomePlaceSelection {
  kind: 'area' | 'project';
  id: string;
  slug?: string;
  name: string;
}

export interface HomeSearchState {
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  unitType: string;
  bedrooms: string;
  budget: string;
  moveIn: string;
  leaseTermMonths: string;
  pets: 'any' | 'yes' | 'no';
}

export const DEFAULT_SEARCH: HomeSearchState = {
  startDate: '',
  endDate: '',
  adults: 2,
  children: 0,
  unitType: '',
  bedrooms: '',
  budget: '',
  moveIn: '',
  leaseTermMonths: '',
  pets: 'any',
};


/** Downstream catalogue link that preserves the compatible search context. */
export function homeCatalogHref(
  intent: HomeIntent,
  place: HomePlaceSelection | null,
  search: HomeSearchState = DEFAULT_SEARCH
): string {
  const params = new URLSearchParams();

  if (intent === 'stay') {
    if (place?.kind === 'area' && place.slug) params.set('areaSlug', place.slug);
    if (place?.kind === 'project') params.set('projectId', place.id);
    if (search.startDate && search.endDate) {
      params.set('startDate', search.startDate);
      params.set('endDate', search.endDate);
      params.set('adults', String(Math.max(1, search.adults)));
      params.set('children', String(Math.max(0, search.children)));
    }
    if (search.unitType) params.set('unitTypes', search.unitType);
    if (search.bedrooms) params.set('bedrooms', search.bedrooms);
    if (search.budget) params.set('maxPrice', search.budget);
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  }

  params.set('intent', intent === 'buy' ? 'buy' : 'rent');
  if (place?.kind === 'area' && place.slug) params.set('area', place.slug);
  if (place?.kind === 'project') params.set('projectId', place.id);
  if (search.unitType) params.set('type', search.unitType);
  if (search.bedrooms) params.set('bedrooms', search.bedrooms);
  if (search.budget) params.set('maxPrice', search.budget);
  if (intent === 'monthly') {
    if (search.moveIn) params.set('moveIn', search.moveIn);
    if (search.leaseTermMonths) params.set('leaseTermMonths', search.leaseTermMonths);
    if (search.pets !== 'any') params.set('pets', search.pets);
  }
  return `/homes?${params.toString()}`;
}
