export interface PlaceSuggestion {
  placeId: string;
  name: string;
  secondaryText: string | null;
  fullText: string;
  types: string[];
}

export interface PlaceLocation {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
}

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  return key;
}

export async function autocompletePhuketProject(
  input: string,
  sessionToken?: string
): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${GOOGLE_PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types',
    },
    body: JSON.stringify({
      input,
      languageCode: 'en',
      regionCode: 'th',
      includedRegionCodes: ['th'],
      ...(sessionToken ? { sessionToken } : {}),
      locationRestriction: {
        rectangle: {
          low: { latitude: 7.70, longitude: 98.20 },
          high: { latitude: 8.25, longitude: 98.52 },
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Places autocomplete failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as any;
  return (payload.suggestions || [])
    .map((item: any) => item.placePrediction)
    .filter(Boolean)
    .map((prediction: any) => ({
      placeId: prediction.placeId,
      name:
        prediction.structuredFormat?.mainText?.text ||
        prediction.text?.text ||
        '',
      secondaryText: prediction.structuredFormat?.secondaryText?.text || null,
      fullText: prediction.text?.text || '',
      types: Array.isArray(prediction.types) ? prediction.types : [],
    }))
    .filter((item: PlaceSuggestion) => item.placeId && item.name);
}

export async function getGooglePlaceLocation(
  placeId: string,
  sessionToken?: string
): Promise<PlaceLocation> {
  const url = new URL(`${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
  url.searchParams.set('languageCode', 'en');
  url.searchParams.set('regionCode', 'th');

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': 'id,formattedAddress,location',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Place details failed: ${response.status} ${message}`);
  }

  const place = (await response.json()) as any;
  if (
    !place.id ||
    !place.location ||
    !Number.isFinite(place.location.latitude) ||
    !Number.isFinite(place.location.longitude)
  ) {
    throw new Error('Google Place has no usable location');
  }

  return {
    placeId: place.id,
    address: place.formattedAddress || '',
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
}
