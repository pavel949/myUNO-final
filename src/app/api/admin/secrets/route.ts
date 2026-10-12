import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { clearVaultValue, revealVaultEntry, saveVaultEntry } from '@/modules/config';
import { prisma } from '@/lib/prisma';
import { SECRET_NAME_PATTERN } from '@/lib/secret-catalog';

export const dynamic = 'force-dynamic';

/** Founder's key register API. Admin-only (admin:edit_configuration); responses never carry a stored value except the explicit reveal. */
async function authorise() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = await can({ identity, action: 'config:edit', resource: { resourceType: 'platform' } });
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { identityId: identity.id };
}

const noStore = { 'Cache-Control': 'no-store' };

/** Save (or update) a value and/or note. */
export async function PUT(req: NextRequest) {
  const auth = await authorise();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!SECRET_NAME_PATTERN.test(name)) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  try {
    await saveVaultEntry(prisma, {
      name,
      value: typeof body?.value === 'string' ? body.value : undefined,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      actorIdentityId: auth.identityId,
    });
  } catch {
    return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}

/** Reveal one stored value. Audited every time. */
export async function POST(req: NextRequest) {
  const auth = await authorise();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!SECRET_NAME_PATTERN.test(name)) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  const value = await revealVaultEntry(prisma, { name, actorIdentityId: auth.identityId });
  if (value === null) return NextResponse.json({ error: 'No value stored' }, { status: 404 });
  return NextResponse.json({ value }, { headers: noStore });
}

/** Remove the stored value (the row and its note stay). */
export async function DELETE(req: NextRequest) {
  const auth = await authorise();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!SECRET_NAME_PATTERN.test(name)) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  await clearVaultValue(prisma, { name, actorIdentityId: auth.identityId });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
