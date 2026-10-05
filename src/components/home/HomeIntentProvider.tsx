'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

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
}

const DEFAULT_SEARCH: HomeSearchState = {
  startDate: '',
  endDate: '',
  adults: 2,
  children: 0,
  unitType: '',
  bedrooms: '',
  budget: '',
};

interface HomeIntentState {
  intent: HomeIntent;
  setIntent: (intent: HomeIntent) => void;
  place: HomePlaceSelection | null;
  setPlace: (place: HomePlaceSelection | null) => void;
  search: HomeSearchState;
  setSearch: Dispatch<SetStateAction<HomeSearchState>>;
}

const HomeIntentContext = createContext<HomeIntentState | null>(null);

/**
 * One chosen task, place and compatible search context for the whole homepage.
 * Search, offer shelves and downstream catalogue links read this same state,
 * so intent/place/dates/guests do not silently disappear between surfaces.
 */
export function HomeIntentProvider({
  initialIntent,
  children,
}: {
  initialIntent: HomeIntent;
  children: ReactNode;
}) {
  const [intent, setIntentState] = useState<HomeIntent>(initialIntent);
  const [place, setPlace] = useState<HomePlaceSelection | null>(null);
  const [search, setSearch] = useState<HomeSearchState>(DEFAULT_SEARCH);

  const setIntent = useCallback((next: HomeIntent) => {
    setIntentState(next);
    // A budget belongs to its commercial intent: nightly, monthly and
    // purchase amounts are never reinterpreted as one another.
    setSearch((current) => ({ ...current, budget: '' }));
    try {
      const url = new URL(window.location.href);
      if (next === 'stay') url.searchParams.delete('intent');
      else url.searchParams.set('intent', next);
      window.history.replaceState(null, '', url);
    } catch {
      // Shared state still works without a shareable URL.
    }
  }, []);

  const value = useMemo(
    () => ({ intent, setIntent, place, setPlace, search, setSearch }),
    [intent, setIntent, place, search]
  );
  return <HomeIntentContext.Provider value={value}>{children}</HomeIntentContext.Provider>;
}

export function useHomeIntent(): HomeIntentState {
  const state = useContext(HomeIntentContext);
  if (!state) throw new Error('useHomeIntent must be used inside HomeIntentProvider');
  return state;
}

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
  return `/homes?${params.toString()}`;
}
