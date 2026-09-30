import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

function component(components: any[], type: string) {
  const value = components.find((entry) => Array.isArray(entry?.types) && entry.types.includes(type));
  return value?.longText || value?.shortText || null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Place lookup is not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';
    if (!placeId) return NextResponse.json({ error: 'placeId is required' }, { status: 400 });

    const query = new URLSearchParams({ languageCode: 'en', regionCode: 'TH' });
    if (sessionToken) query.set('sessionToken', sessionToken);

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query.toString()}`,
      {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: 'Google Places lookup failed', detail: detail.slice(0, 500) },
        { status: response.status }
      );
    }

    const place = await response.json();
    const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
    const latitude = Number(place.location?.latitude);
    const longitude = Number(place.location?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Selected place has no usable coordinates' }, { status: 422 });
    }

    return NextResponse.json({
      placeId: String(place.id || placeId),
      address: String(place.formattedAddress || ''),
      latitude,
      longitude,
      country: component(components, 'country') || 'Thailand',
      region: component(components, 'administrative_area_level_1'),
      district:
        component(components, 'administrative_area_level_2') ||
        component(components, 'sublocality_level_1'),
      city:
        component(components, 'locality') ||
        component(components, 'postal_town') ||
        component(components, 'administrative_area_level_2'),
      subdistrict:
        component(components, 'sublocality_level_2') ||
        component(components, 'sublocality_level_1'),
      postcode: component(components, 'postal_code'),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Place lookup failed' },
      { status: 400 }
    );
  }
}
