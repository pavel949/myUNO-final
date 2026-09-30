import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { resolveIntegrationValue } from '@/modules/integrations/admin-registry';

const GOOGLE_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = await resolveIntegrationValue(prisma, 'google_places', 'apiKey', 'GOOGLE_PLACES_API_KEY');
  if (!key) {
    return NextResponse.json({ error: 'Place suggestions are not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';
    if (input.length < 3) return NextResponse.json({ suggestions: [] });

    const response = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
      },
      body: JSON.stringify({
        input,
        languageCode: 'en',
        regionCode: 'TH',
        includedRegionCodes: ['th'],
        locationBias: {
          circle: {
            center: { latitude: 7.9519, longitude: 98.3381 },
            radius: 80000,
          },
        },
        ...(sessionToken ? { sessionToken } : {}),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: 'Google Places autocomplete failed', detail: detail.slice(0, 500) },
        { status: response.status }
      );
    }

    const payload = await response.json();
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
          .map((item: any) => item?.placePrediction)
          .filter(Boolean)
          .map((prediction: any) => ({
            placeId: String(prediction.placeId || ''),
            text: String(prediction.text?.text || ''),
            name: String(prediction.structuredFormat?.mainText?.text || prediction.text?.text || ''),
            secondaryText: String(prediction.structuredFormat?.secondaryText?.text || ''),
          }))
          .filter((item: { placeId: string; text: string }) => item.placeId && item.text)
      : [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Autocomplete failed' },
      { status: 400 }
    );
  }
}
