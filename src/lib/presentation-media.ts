/**
 * Presentation-only imagery used while canonical Project/Service media is absent.
 *
 * This is deliberately not a property/service data source. Domain cover media
 * always wins. These licensed editorial placeholders keep public discovery
 * surfaces visually complete until an admin uploads the real cover image.
 */
const PROJECT_FALLBACKS = [
  'https://images.unsplash.com/photo-1774280960001-ce8169cfc38f?auto=format&fit=crop&fm=jpg&q=82&w=2400',
  'https://images.unsplash.com/photo-1759805583363-87fdee48b581?auto=format&fit=crop&fm=jpg&q=82&w=2400',
] as const;

const SERVICE_FALLBACKS = [
  'https://images.unsplash.com/photo-1759805583363-87fdee48b581?auto=format&fit=crop&fm=jpg&q=82&w=1800',
  'https://images.unsplash.com/photo-1774280960001-ce8169cfc38f?auto=format&fit=crop&fm=jpg&q=82&w=1800',
] as const;

function stableIndex(id: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % length;
}

export function projectPresentationImage(projectId: string, coverUrl: string | null): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  return { src: PROJECT_FALLBACKS[stableIndex(projectId, PROJECT_FALLBACKS.length)], illustrative: true };
}

/**
 * Per-category stand-ins, so a car-hire card shows scooters, not a resort.
 * Picked by their Unsplash Lite dataset captions (quoted) and checked to load
 * through /_next/image on 2026-10-05. Unsplash License. Real service media,
 * once uploaded, always wins; these stay marked as illustrative.
 */
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&fm=jpg&q=82&w=1800`;
const SERVICE_CATEGORY_FALLBACKS: Record<string, string> = {
  car_hire: UNSPLASH('photo-1550649613-66b6ac02f56d'), // "motorcycles parked in front of bricked building"
  transfer: UNSPLASH('photo-1541890289-b86df5bafd81'), // "high-angle photography of car on road between trees"
  cleaning: UNSPLASH('photo-1744042829912-eae1e0e7dc73'), // "woman wakes up in a bright bedroom"
  laundry: UNSPLASH('photo-1744042829912-eae1e0e7dc73'),
  chef: UNSPLASH('photo-1565696080740-4a8dd740db36'), // "food cooking on black pot"
  deliveries: UNSPLASH('photo-1745367228695-a1c7a12df13f'), // "a produce stand sells fresh fruits and vegetables"
  water_delivery: UNSPLASH('photo-1565067132191-c4fb663c0e9b'), // "clear glass bottle on table"
  flowers: UNSPLASH('photo-1568010967378-b92ea68220c5'), // "variety of flowers bouquet"
  repairs: UNSPLASH('photo-1556912743-90a361c19b16'), // "work boots beside gloves and handheld tools"
  tours: UNSPLASH('photo-1437719417032-8595fd9e9dc6'), // "white boat on body of water near green palm trees"
  yacht: UNSPLASH('photo-1591989600120-ac94311508ce'), // "white boat on blue sea water during daytime"
  massage_spa: UNSPLASH('photo-1559548290-d6b0cb6c9050'), // "two white tea light candles"
  babysitting: UNSPLASH('photo-1414872837206-7620d2ae7566'), // "man and woman sitting beside toddler"
  emergency_medical: UNSPLASH('photo-1580377968242-daed42865732'), // "green oval medication pill lot"
};

export function servicePresentationImage(
  serviceId: string,
  coverUrl: string | null,
  categoryKey?: string | null,
): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  const byCategory = categoryKey ? SERVICE_CATEGORY_FALLBACKS[categoryKey] : undefined;
  if (byCategory) return { src: byCategory, illustrative: true };
  return { src: SERVICE_FALLBACKS[stableIndex(serviceId, SERVICE_FALLBACKS.length)], illustrative: true };
}
