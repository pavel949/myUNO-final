import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { PropertyCapabilityError } from '@/modules/core/property-capability-access';
import { previewPropertyBookingMode, applyPropertyBookingMode } from '@/modules/projects/property-booking-mode';
export const dynamic = 'force-dynamic';
function parse(body: unknown, apply: boolean) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PropertyCapabilityError('Invalid booking mode request', 400);
  const value = body as Record<string, unknown>;
  const keys = apply ? ['scope', 'instantBook', 'baseline', 'requestId'] : ['scope', 'instantBook'];
  if (Object.keys(value).some(key => !keys.includes(key)) || typeof value.instantBook !== 'boolean' ||
    (value.scope !== 'unit' && value.scope !== 'category') ||
    (apply && (typeof value.baseline !== 'string' || typeof value.requestId !== 'string')))
    throw new PropertyCapabilityError('Invalid booking mode request', 400);
  return value as { scope: 'unit' | 'category'; instantBook: boolean; baseline: string; requestId: string };
}
async function handle(request: Request, unitId: string, apply: boolean) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = parse(await request.json().catch(() => null), apply);
    const input = { ...body, unitId, actorIdentityId: user.identityId };
    return NextResponse.json(apply ? await applyPropertyBookingMode(prisma, input) : await previewPropertyBookingMode(prisma, input));
  } catch (error) {
    return error instanceof PropertyCapabilityError
      ? NextResponse.json({ error: error.message }, { status: error.status })
      : NextResponse.json({ error: 'Could not update booking mode' }, { status: 500 });
  }
}
export async function POST(request: Request, props: { params: Promise<{ unitId: string }> }) {
  const params = await props.params;
  return handle(request, params.unitId, false);
}
export async function PUT(request: Request, props: { params: Promise<{ unitId: string }> }) {
  const params = await props.params;
  return handle(request, params.unitId, true);
}
