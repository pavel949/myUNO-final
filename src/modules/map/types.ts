export type MapEntityKind = 'project' | 'unit' | 'provider' | 'service';

export interface MapEntity {
  id: string;
  kind: MapEntityKind;
  title: string;
  subtitle?: string | null;
  latitude: number;
  longitude: number;
  href: string;
  coverUrl?: string | null;
  badge?: string | null;
  projectId?: string | null;
  providerId?: string | null;
}

export const MAP_ENTITY_KINDS: MapEntityKind[] = ['project', 'unit', 'provider', 'service'];

export function isMapEntityKind(value: string): value is MapEntityKind {
  return MAP_ENTITY_KINDS.includes(value as MapEntityKind);
}
