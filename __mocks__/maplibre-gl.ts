import { createMapLibreFake } from '@/test/doubles/maplibre-test-double';

const fake = createMapLibreFake();
export const { Map, Marker, NavigationControl, Popup, LngLatBounds } = fake.api;
export const maps = fake.maps;
export const markers = fake.markers;
export default fake.api;
