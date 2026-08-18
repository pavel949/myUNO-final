import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import { UNIT_SORTS } from '@/modules/browse';
import SearchResults from './search-results';

export const dynamic = 'force-dynamic';

/**
 * English fallbacks for the sort picker, keyed off the one catalog so a new
 * sort option cannot appear in the API without a label here.
 */
const SORT_LABEL_FALLBACKS: Record<string, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  bedrooms_desc: 'Most bedrooms',
  capacity_desc: 'Sleeps the most',
  top_rated: 'Top rated',
};

export default async function SearchPage() {
  const sortLabels = await getLabels(
    Object.fromEntries(
      UNIT_SORTS.map((sort) => [sort.labelKey, SORT_LABEL_FALLBACKS[sort.key] ?? sort.key])
    )
  );

  const labels = await getLabels({
    'search.title': 'Find your stay',
    'search.results_summary': '{from} to {to} · {guests} guests',
    'search.prompt': 'Choose your dates to see available homes.',
    'search.loading': 'Loading results…',
    'search.error_generic': 'Something went wrong. Please try again.',
    'search.empty': 'No homes are available for these dates.',
    'search.empty_hint': 'Try different dates or a shorter stay.',
    'search.per_night': 'per night',
    'search.showing': 'Showing {shown} of {total} results',
    'search.categories.title': 'Book by category',
    'search.categories.available': '{count} villas available',
    'search.categories.from': 'from ฿{price} / night',
    'search.categories.book': 'Request this category',
    'search.categories.booking': 'Sending request…',
    'search.categories.auto_assign': 'We assign the best free villa of this category to your dates.',
    'search.error_booking': 'Could not create the request. Please try again.',
    'search.sort_label': 'Sort by',
    'search.load_more': 'Show more homes',
    'search.loading_more': 'Loading…',
    'search.rating_summary': '{rating} · {count} reviews',
    'search.bar_check_in': 'Check-in',
    'search.bar_check_out': 'Check-out',
    'search.bar_adults': 'Adults',
    'search.bar_children': 'Children',
    'search.bar_submit': 'Search',
  });

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-background p-32">
          <p className="text-body text-text-secondary">{labels['search.loading']}</p>
        </div>
      }
    >
      <SearchResults
        labels={{
          title: labels['search.title'],
          resultsSummary: labels['search.results_summary'],
          prompt: labels['search.prompt'],
          loading: labels['search.loading'],
          errorGeneric: labels['search.error_generic'],
          empty: labels['search.empty'],
          emptyHint: labels['search.empty_hint'],
          perNight: labels['search.per_night'],
          showing: labels['search.showing'],
          categoriesTitle: labels['search.categories.title'],
          categoryAvailable: labels['search.categories.available'],
          categoryFrom: labels['search.categories.from'],
          categoryBook: labels['search.categories.book'],
          categoryBooking: labels['search.categories.booking'],
          categoryAutoAssign: labels['search.categories.auto_assign'],
          errorBooking: labels['search.error_booking'],
          sortLabel: labels['search.sort_label'],
          loadMore: labels['search.load_more'],
          loadingMore: labels['search.loading_more'],
          ratingSummary: labels['search.rating_summary'],
          barCheckIn: labels['search.bar_check_in'],
          barCheckOut: labels['search.bar_check_out'],
          barAdults: labels['search.bar_adults'],
          barChildren: labels['search.bar_children'],
          barSubmit: labels['search.bar_submit'],
        }}
        sortOptions={UNIT_SORTS.map((sort) => ({
          key: sort.key,
          label: sortLabels[sort.labelKey],
        }))}
      />
    </Suspense>
  );
}
