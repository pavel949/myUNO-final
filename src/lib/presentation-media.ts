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

/**
 * Sample photography for homes (villas, condos) that have no real photos yet
 * — founder ruling 2026-10-06: show labelled sample photos instead of an empty
 * frame, always marked "Sample photo · to be replaced" in the UI. Picked from
 * the Unsplash Lite dataset by caption (quoted). Unsplash License. Real unit
 * or category media always wins; nothing here describes the actual home.
 */
const HOME_SAMPLES = {
  villa: [
    UNSPLASH('photo-1553337483-78c19e504060'), // "aerial view of gazebos pool villa"
    UNSPLASH('photo-1580213845003-ace9a84fee11'), // "aerial view of swimming pool surrounded by trees"
    UNSPLASH('photo-1744042829912-eae1e0e7dc73'), // "woman wakes up in a bright bedroom"
    UNSPLASH('photo-1555698152-c637efae776f'), // "top-angle photography of outdoor swimming pool"
    UNSPLASH('photo-1582805322574-e6ba46b158d5'), // "hydrangeas flowers in the living room"
    UNSPLASH('photo-1452772783921-a4e5de72b718'), // "tropical sand beach"
  ],
  condo: [
    UNSPLASH('photo-1572331165267-854da2b10ccc'), // "rooftop swimming pool"
    UNSPLASH('photo-1542915397-17ac00eb52e4'), // "white high-rise building"
    UNSPLASH('photo-1744042829912-eae1e0e7dc73'), // "woman wakes up in a bright bedroom"
    UNSPLASH('photo-1491835236783-61f0a09f4e15'), // "swimming pool with sun lounge chairs nearby blue sea"
    UNSPLASH('photo-1582805322574-e6ba46b158d5'), // "hydrangeas flowers in the living room"
    UNSPLASH('photo-1452772783921-a4e5de72b718'), // "tropical sand beach"
  ],
} as const;

/**
 * Amenity stand-ins chosen by keyword in the amenity's category or name, from
 * the same verified Unsplash set. Always shown with the sample-photo badge.
 */
const AMENITY_SAMPLES: Array<[RegExp, string]> = [
  [/pool|swim|jacuzzi/i, UNSPLASH('photo-1555698152-c637efae776f')],
  [/spa|massage|wellness|sauna/i, UNSPLASH('photo-1559548290-d6b0cb6c9050')],
  [/restaurant|dining|cafe|bar|kitchen|food|breakfast/i, UNSPLASH('photo-1565696080740-4a8dd740db36')],
  [/beach|sea|shore/i, UNSPLASH('photo-1452772783921-a4e5de72b718')],
  [/boat|tour|excursion|marina/i, UNSPLASH('photo-1437719417032-8595fd9e9dc6')],
];

export function amenityPresentationImage(
  coverUrl: string | null | undefined, categoryKey?: string | null, name?: string | null,
): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  const haystack = `${categoryKey ?? ''} ${name ?? ''}`;
  const match = AMENITY_SAMPLES.find(([pattern]) => pattern.test(haystack));
  return { src: match ? match[1] : UNSPLASH('photo-1580213845003-ace9a84fee11'), illustrative: true };
}

type HomeKind = keyof typeof HOME_SAMPLES;
const homeKind = (kind?: string | null): HomeKind =>
  kind && /condo|apartment|studio|penthouse|loft/i.test(kind) ? 'condo' : 'villa';

/** One cover image for a home card: the real cover, or a labelled sample. */
export function homePresentationImage(
  id: string, coverUrl: string | null | undefined, kind?: string | null,
): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  const pool = HOME_SAMPLES[homeKind(kind)];
  return { src: pool[stableIndex(id, pool.length)], illustrative: true };
}

/** A gallery for a home page: the real photos, or a labelled sample set. */
export function homePresentationGallery(
  id: string, images: string[], kind?: string | null,
): { images: string[]; illustrative: boolean } {
  if (images.length) return { images, illustrative: false };
  const pool = HOME_SAMPLES[homeKind(kind)];
  const start = stableIndex(id, pool.length);
  return { images: [...pool.slice(start), ...pool.slice(0, start)].slice(0, 5), illustrative: true };
}
