import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import SearchResults from './search-results';

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
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
          barCheckIn: labels['search.bar_check_in'],
          barCheckOut: labels['search.bar_check_out'],
          barAdults: labels['search.bar_adults'],
          barChildren: labels['search.bar_children'],
          barSubmit: labels['search.bar_submit'],
        }}
      />
    </Suspense>
  );
}
