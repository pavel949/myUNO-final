import { hasSelfListingAccess } from './supplierListingAccess';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';

/** Authorization for writes to existing canonical gallery relations. */
export async function managedMediaAccess(scope: { projectId: string; unitId?: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const staff = await prisma.roleAssignment.findFirst({
    where: {
      identityId: user.identityId, status: 'active', role: 'staff_ops',
      projectId: scope.projectId,
      OR: [{ scopeType: 'project' as const }, ...(scope.unitId ? [{ scopeType: 'unit' as const, unitId: scope.unitId }] : [])],
    },
    select: { id: true },
  });
  // A condominium project is shared: MC members can edit a mandated UNIT gallery,
  // never a whole project gallery or unrelated condominium units.
  const mc = scope.unitId ? await hasManagedUnitMcAccess(user, {
    projectId: scope.projectId, unitId: scope.unitId,
  }) : false;
  const selfListing = scope.unitId ? await hasSelfListingAccess(user.identityId, scope.unitId) : false;
  if (!user.isAdmin && !staff && !mc && !selfListing) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function assertPublicPhoto(mediaAssetId: unknown, actorId: string, isAdmin: boolean) {
  if (typeof mediaAssetId !== 'string' || !mediaAssetId) return false;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, kind: 'photo', encrypted: false, sizeBytes: { gt: 0 }, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
      ...(!isAdmin ? { uploadedByIdentityId: actorId } : {}) },
    select: { id: true },
  });
  return Boolean(asset);
}
