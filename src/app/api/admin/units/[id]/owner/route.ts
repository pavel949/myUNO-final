import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setUnitOwner, getOwnershipHistory, onboardUnitOwner } from '@/modules/projects';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const history = await getOwnershipHistory(prisma, params.id);
  return NextResponse.json({ history });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();

    // F11 inline path: exact email → existing identity or invited identity →
    // ownership → scoped owner role → claim token, all as one orchestration.
    if (body.email) {
      const result = await onboardUnitOwner(prisma, {
        unitId: params.id,
        email: String(body.email),
        firstName: String(body.firstName || ''),
        lastName: String(body.lastName || ''),
        phone: body.phone ? String(body.phone) : undefined,
        preferredLocale: body.preferredLocale ? String(body.preferredLocale) : undefined,
        recordedByIdentityId: guard.actorIdentityId,
        note: body.note ? String(body.note) : undefined,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      });

      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'units:owner_onboarded',
        entityType: 'Unit',
        entityId: params.id,
        data: {
          ownerIdentityId: result.identity.id,
          createdIdentity: result.created,
          ownershipChanged: result.ownershipChanged,
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
      return NextResponse.json({
        ...result,
        claimUrl: result.claimToken
          ? `${baseUrl}/auth/claim?token=${encodeURIComponent(result.claimToken)}`
          : null,
      });
    }

    if (!body.ownerIdentityId) {
      return NextResponse.json(
        { error: 'Provide ownerIdentityId or inline owner email/name details' },
        { status: 400 }
      );
    }

    const owner = await prisma.identity.findUnique({
      where: { id: body.ownerIdentityId },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: 'Owner identity not found' }, { status: 404 });
    }

    const result = await setUnitOwner(prisma, {
      unitId: params.id,
      ownerIdentityId: body.ownerIdentityId,
      recordedByIdentityId: guard.actorIdentityId,
      note: body.note,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
    });

    if (result.changed) {
      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'units:owner_changed',
        entityType: 'Unit',
        entityId: params.id,
        data: { ownerIdentityId: body.ownerIdentityId, note: body.note ?? null },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return failed(error, 'Failed to set up the owner');
  }
}
