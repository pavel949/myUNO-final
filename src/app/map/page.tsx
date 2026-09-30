import { getLabels } from '@/lib/i18n';
import MapExplorer from './map-explorer';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const labels = await getLabels({
    'map.title': 'Explore Phuket',
    'map.subtitle': 'Homes, residences, trusted partners and services across Phuket.',
    'map.search_placeholder': 'Search Phuket',
    'map.loading': 'Loading map…',
    'map.error': 'The map could not be loaded.',
    'map.empty': 'Nothing matches these filters.',
    'map.filter.all': 'All',
    'map.filter.projects': 'Projects',
    'map.filter.homes': 'Homes',
    'map.filter.partners': 'Partners',
    'map.filter.services': 'Services',
    'map.results': '{count} places',
    'map.open': 'Open',
  });

  return <MapExplorer labels={labels} />;
}
