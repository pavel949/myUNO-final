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
import { deviceClass, trackPublicInteraction } from '@/components/public-analytics';
import {
  DEFAULT_SEARCH,
  type HomeIntent,
  type HomePlaceSelection,
  type HomeSearchState,
} from './home-intent';

export type { HomeIntent, HomePlaceSelection, HomeSearchState };

interface HomeIntentState {
  intent: HomeIntent;
  locale: string;
  destination: string;
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
  locale,
  destination,
  children,
}: {
  initialIntent: HomeIntent;
  locale: string;
  destination: string;
  children: ReactNode;
}) {
  const [intent, setIntentState] = useState<HomeIntent>(initialIntent);
  const [place, setPlace] = useState<HomePlaceSelection | null>(null);
  const [search, setSearch] = useState<HomeSearchState>(DEFAULT_SEARCH);

  const setIntent = useCallback((next: HomeIntent) => {
    setIntentState(next);
    trackPublicInteraction('intent_selected', {
      destination,
      locale,
      intent: next,
      source: 'homepage',
      deviceClass: deviceClass(),
    });
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
  }, [destination, locale]);

  const value = useMemo(
    () => ({ intent, locale, destination, setIntent, place, setPlace, search, setSearch }),
    [intent, locale, destination, setIntent, place, search]
  );
  return <HomeIntentContext.Provider value={value}>{children}</HomeIntentContext.Provider>;
}

export function useHomeIntent(): HomeIntentState {
  const state = useContext(HomeIntentContext);
  if (!state) throw new Error('useHomeIntent must be used inside HomeIntentProvider');
  return state;
}
