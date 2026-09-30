import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { cancelOwnProjectAmenityReservation } from '@/modules/projects';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { logAudit } from '@/modules/audit';
import { getProjectAmenityOpsActor } from '@/app/libs/projectExperienceGuard';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('Unauthorized', 401);
    const reservation = await cancelOwnProjectAmenityReservation(prisma, {
      reservationId: params.id,
      identityId: user.identityId,
      privileged: user.isAdmin,
    });
    return NextResponse.json({ reservation });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('Unauthorized', 401);
    const target = await prisma.projectAmenityReservation.findUnique({
      where: { id: params.id },
      select: { amenity: { select: { projectId: true } } },
    });
    if (!target) throw createPublicError('Amenity reservation not found', 404);
    const actor = await getProjectAmenityOpsActor(target.amenity.projectId);
    if (!actor) throw createPublicError('Forbidden', 403);
    const body = await req.json().catch(() => null);
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!['pending','confirmed','cancelled','completed'].includes(status)) {
      throw createPublicError('Invalid reservation status', 400);
    }
    const reservation = await prisma.projectAmenityReservation.update({
      where: { id: params.id },
      data: { status },
    });
    await logAudit({
      actorIdentityId: actor.identityId,
      action: 'project_amenity_reservation:status',
      entityType: 'ProjectAmenityReservation',
      entityId: reservation.id,
      data: { status },
    });
    return NextResponse.json({ reservation });
  } catch (error) {
    return handleError(error);
  }
}
