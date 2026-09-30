export const PHUKET_MAP_CENTER = {
  latitude: 7.9519,
  longitude: 98.3381,
} as const;

export const PHUKET_MAP_ZOOM = 10.25;

/**
 * MapLibre is the renderer. The style URL is configuration, not domain data,
 * so production can point at self-hosted Phuket vector tiles without changing
 * Projects, Units, Providers or Services.
 */
export function getPublicMapStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/liberty'
  );
}

export function getPublicMapProvider(): string {
  return process.env.NEXT_PUBLIC_MAP_PROVIDER || 'maplibre';
}
