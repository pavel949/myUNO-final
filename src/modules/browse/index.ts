/**
 * Browse & Marketplace Module
 *
 * Property discovery lives in `src/app/api/search/units` (queries `prisma`
 * directly plus `core`/`content`/`projects`/`analytics`), not here — an
 * earlier `BrowseService` placeholder that unconditionally returned empty
 * arrays sat in this file with zero callers and was removed 2026-09-29. This
 * module holds what's actually real and wired: saved units/searches, unit
 * sort, unit ratings, and map bounds, below.
 */

// Saved villas and saved searches. Matching is here; what an alert *does* is a
// founder decision (Q38), so nothing in this module sends anything.
export {
  saveUnit,
  unsaveUnit,
  listSavedUnits,
  listSavedCollections,
  saveSearch,
  listSavedSearches,
  deleteSavedSearch,
  matchesSavedSearch,
  findSearchesMatching,
  type SaveUnitInput,
  type SearchCriteria,
  type MatchableUnit,
} from './saved.service';

// How a list of villas is ordered. The catalog is defined once so the API, the
// picker, and the tests cannot disagree about what a valid sort is.
export {
  UNIT_SORTS,
  DEFAULT_UNIT_SORT,
  parseUnitSort,
  rankByRating,
  type UnitSort,
  type UnitSortKey,
  type RatedForSort,
} from './sort';

// A villa's rating, assembled back through its bookings — stay reviews target
// the booking, not the unit.
export { getUnitRatings, getUnitRating, type UnitRating } from './unit-rating.service';

// "Show me what's in this area." Filters on the project's coordinates, because
// a unit's location is its project's.
export { parseMapBounds, boundsWhere, type MapBounds, type BoundsParse } from './bounds';
