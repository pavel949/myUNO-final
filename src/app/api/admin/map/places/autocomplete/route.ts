import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { autocompletePhuketProject } from '@/modules/map';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const input = (req.nextUrl.searchParams.get('input') || '').trim();
  const sessionToken = (req.nextUrl.searchParams.get('sessionToken') || '').trim() || undefined;

  if (input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await autocompletePhuketProject(input, sessionToken);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Place search failed' },
      { status: 502 }
    );
  }
}
