import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getPublicUnitById } from '@/modules/projects';
import { saveUnit, unsaveUnit } from '@/modules/browse/saved.service';
import { handleError } from '@/app/libs/errorHandler';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/** Session-scoped default shortlist. Never accept an identity from the browser. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.identityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const entries = await prisma.savedUnit.findMany({
    where: { identityId: user.identityId, collection: null }, select: { unitId: true },
  });
  return NextResponse.json({ unitIds: entries.map(row => row.unitId) }, { headers });
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.unitId !== 'string' || !body.unitId || body.unitId.length > 200 || typeof body.saved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid saved home' }, { status: 400, headers });
    }
    // Removing is allowed even after a listing disappears. New saves only
    // target the public stay reader, never an arbitrary private unit ID.
    if (body.saved && !await getPublicUnitById(body.unitId)) {
      return NextResponse.json({ error: 'Home unavailable' }, { status: 404, headers });
    }
    await prisma.$transaction(async tx => {
      // NULL collections have no unique DB constraint. Serialize the canonical
      // default-list writer so retries/two browser tabs cannot duplicate saves.
      const key = `saved-unit:${user.identityId}:${body.unitId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      if (!body.saved) await unsaveUnit(tx, user.identityId, body.unitId);
      else await saveUnit(tx, { identityId: user.identityId, unitId: body.unitId });
    });
    return NextResponse.json({ saved: body.saved }, { headers });
  } catch (error) { return handleError(error); }
}
