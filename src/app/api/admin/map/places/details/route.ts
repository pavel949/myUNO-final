import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getGooglePlaceLocation } from '@/modules/map';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const placeId = (req.nextUrl.searchParams.get('placeId') || '').trim();
  const sessionToken = (req.nextUrl.searchParams.get('sessionToken') || '').trim() || undefined;

  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
  }

  try {
    const place = await getGooglePlaceLocation(placeId, sessionToken);
    return NextResponse.json(place);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Place lookup failed' },
      { status: 502 }
    );
  }
}
