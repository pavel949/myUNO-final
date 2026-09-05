import { getProviderApplications } from '@/modules/services';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const status = req.nextUrl.searchParams.get('status') || 'applied';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const providers = await getProviderApplications(prisma, {
      status,
      limit,
      offset,
    });
    return NextResponse.json(providers);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch providers' },
      { status: 400 }
    );
  }
}
