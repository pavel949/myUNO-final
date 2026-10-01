import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { canWriteUnitListing } from '@/modules/core';

/** Authorization for writes to existing canonical gallery relations. */
export async function managedMediaAccess(scope: { projectId: string; unitId?: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) } as const;

  if (scope.unitId) {
    const allowed = await canWriteUnitListing(
      prisma,
      identity,
      scope.unitId,
      scope.projectId
    );
    if (!allowed) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
    }
    return { user } as const;
  }

  // Shared project media remains an operator/admin responsibility. A direct
  // owner may edit their exact Unit gallery without changing common project
  // photography used by other owners.
  const staff = await prisma.roleAssignment.findFirst({
    where: {
      identityId: user.identityId,
      status: 'active',
      role: 'staff_ops',
      projectId: scope.projectId,
      scopeType: 'project',
    },
    select: { id: true },
  });
  if (!user.isAdmin && !staff) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function assertPublicPhoto(mediaAssetId: unknown, actorId: string, isAdmin: boolean) {
  if (typeof mediaAssetId !== 'string' || !mediaAssetId) return false;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, kind: 'photo', encrypted: false, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
      ...(!isAdmin ? { uploadedByIdentityId: actorId } : {}) },
    select: { id: true },
  });
  return Boolean(asset);
}
