import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { canWithAccess, type RequiredAccess } from '@/modules/core/authority.service';
import { prisma } from '@/lib/prisma';
import type { Identity } from '@prisma/client';

/**
 * The guard the onboarding routes share.
 *
 * Five routes were about to repeat the same twenty lines — fetch the session,
 * load the identity, ask `can()` — and a guard copied five times is a guard
 * that will eventually differ in one of them.
 *
 * Returns either the identity or the response to send. Callers must check
 * `error` first; there is no way to reach the identity without doing so.
 */
export type GuardResult =
  | { ok: true; identity: Identity; actorIdentityId: string }
  | { ok: false; error: NextResponse };

async function loadIdentity(): Promise<GuardResult | { identity: Identity }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { ok: false, error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
  }

  return { identity };
}

export interface RequireActionOptions {
  requiredAccess?: RequiredAccess;
  projectId?: string;
  unitId?: string;
}

/**
 * Guard a route on a doc 03 matrix action.
 *
 * Existing callers retain legacy `can()` semantics. Mutation routes that have
 * read-only roles in the permission matrix must pass `requiredAccess: 'allow'`.
 * Unit-scoped checks resolve the unit's project so project-level assignments
 * are evaluated against the real resource instead of a platform placeholder.
 */
export async function requireAction(
  action: string,
  options: RequireActionOptions = {}
): Promise<GuardResult> {
  const loaded = await loadIdentity();
  if ('ok' in loaded) return loaded;

  if (!options.requiredAccess) {
    const allowed = await can({
      identity: loaded.identity,
      action,
      resource: { resourceType: 'platform' },
    });
    if (!allowed) {
      return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { ok: true, identity: loaded.identity, actorIdentityId: loaded.identity.id };
  }

  let projectId = options.projectId;
  if (options.unitId && !projectId) {
    const unit = await prisma.unit.findUnique({
      where: { id: options.unitId },
      select: { projectId: true },
    });
    if (!unit) {
      return { ok: false, error: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) };
    }
    projectId = unit.projectId;
  }

  const allowed = await canWithAccess(prisma, {
    identity: loaded.identity,
    action,
    requiredAccess: options.requiredAccess,
    resource: { projectId, unitId: options.unitId },
  });
  if (!allowed) {
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, identity: loaded.identity, actorIdentityId: loaded.identity.id };
}

/**
 * Guard a route on admin alone.
 *
 * Used where doc 03's matrix has no row for the capability — setting a unit's
 * commercial terms (the engagement) and changing who owns it. Both are money
 * and title decisions, and inventing a matrix row for them would be writing
 * policy the founder owns. Admin-only is the narrow, reversible reading;
 * widening it to staff is **Q42**.
 */
export async function requireAdmin(already?: { identityId: string }): Promise<GuardResult> {
  let identity: Identity;
  if (already?.identityId) {
    const found = await prisma.identity.findUnique({ where: { id: already.identityId } });
    if (!found) {
      return { ok: false, error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
    }
    identity = found;
  } else {
    const loaded = await loadIdentity();
    if ('ok' in loaded) return loaded;
    identity = loaded.identity;
  }

  if (!identity.isAdmin) {
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, identity, actorIdentityId: identity.id };
}

/** Turn a thrown service error into the response it deserves. */
export function failed(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  const notFound = /not found/i.test(message);
  return NextResponse.json({ error: message }, { status: notFound ? 404 : 400 });
}
