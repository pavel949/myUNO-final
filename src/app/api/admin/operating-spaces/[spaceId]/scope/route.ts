import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

export async function PUT(
  request: NextRequest,
  { params }: { params: { spaceId: string } },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await request.json() as { unitIds?: string[] };
    const unitIds = Array.from(new Set(
      Array.isArray(body.unitIds) ? body.unitIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : [],
    ));

    const space = await prisma.operatingSpace.findUnique({
      where: { id: params.spaceId },
      select: { id: true, status: true },
    });
    if (!space) return NextResponse.json({ error: 'Operating space not found' }, { status: 404 });

    const existingUnits = unitIds.length
      ? await prisma.unit.findMany({
          where: { id: { in: unitIds }, status: { not: 'offboarded' } },
          select: { id: true },
        })
      : [];
    if (existingUnits.length !== unitIds.length) {
      return NextResponse.json({ error: 'One or more units are invalid or offboarded' }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.operatingSpaceUnit.updateMany({
        where: {
          operatingSpaceId: params.spaceId,
          active: true,
          ...(unitIds.length ? { unitId: { notIn: unitIds } } : {}),
        },
        data: { active: false, endsOn: now },
      });

      for (const unitId of unitIds) {
        await tx.operatingSpaceUnit.upsert({
          where: {
            operatingSpaceId_unitId: {
              operatingSpaceId: params.spaceId,
              unitId,
            },
          },
          create: {
            operatingSpaceId: params.spaceId,
            unitId,
            active: true,
            startsOn: now,
            endsOn: null,
          },
          update: {
            active: true,
            endsOn: null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorIdentityId: guard.actorIdentityId,
          action: 'operating_space.scope_updated',
          entityType: 'operating_space',
          entityId: params.spaceId,
          data: { unitIds },
        },
      });
    });

    return NextResponse.json({ operatingSpaceId: params.spaceId, unitIds });
  } catch (error) {
    return failed(error, 'Could not update operating-space scope');
  }
}
