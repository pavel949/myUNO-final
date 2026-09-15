import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { clearConfigCache, getConfig } from '@/modules/config';
import { logAudit } from '@/modules/audit';
import type { UnitCategoryEntry } from '@/modules/config/types';

const CATEGORY_KEY = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
  const categoryKey = typeof body?.categoryKey === 'string' ? body.categoryKey.trim().toLowerCase() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const bedrooms = Number(body?.bedrooms);
  const bathrooms = Number(body?.bathrooms);
  const maxGuests = Number(body?.maxGuests);
  const baseNightlyThb = Number(body?.baseNightlyThb);
  const minNights = Number(body?.minNights);

  if (!projectId || !name || !CATEGORY_KEY.test(categoryKey)) {
    return NextResponse.json(
      { error: 'projectId, name and a lowercase underscore categoryKey are required' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || !Number.isInteger(bathrooms) || bathrooms < 0) {
    return NextResponse.json({ error: 'Bedrooms and bathrooms must be non-negative integers' }, { status: 400 });
  }
  if (!Number.isInteger(maxGuests) || maxGuests < 1) {
    return NextResponse.json({ error: 'maxGuests must be at least 1' }, { status: 400 });
  }
  if (!Number.isInteger(baseNightlyThb) || baseNightlyThb < 0) {
    return NextResponse.json({ error: 'baseNightlyThb must be a non-negative integer in satang' }, { status: 400 });
  }
  if (!Number.isInteger(minNights) || minNights < 1) {
    return NextResponse.json({ error: 'minNights must be at least 1' }, { status: 400 });
  }

  const [project, duplicate] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    prisma.inventoryCategory.findUnique({
      where: { projectId_categoryKey: { projectId, categoryKey } },
      select: { id: true },
    }),
  ]);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (duplicate) {
    return NextResponse.json({ error: 'A category with this key already exists in the project' }, { status: 409 });
  }

  const currentCatalog = ((await getConfig(prisma, 'catalog.unit_categories', { projectId })) ?? []) as UnitCategoryEntry[];
  if (currentCatalog.some((entry) => entry.key === categoryKey)) {
    return NextResponse.json({ error: 'This category key already exists in the project catalog' }, { status: 409 });
  }
  const nextCatalog: UnitCategoryEntry[] = [
    ...currentCatalog,
    { key: categoryKey, bedrooms },
  ];

  try {
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCategory.create({
        data: {
          projectId,
          categoryKey,
          name,
          bedrooms,
          bathrooms,
          maxGuests,
          baseNightlyThb,
          minNights,
          status: 'live',
        },
      });

      const existingOverride = await tx.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'catalog.unit_categories',
            scopeType: 'project',
            scopeId: projectId,
          },
        },
      });

      await tx.configOverride.upsert({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'catalog.unit_categories',
            scopeType: 'project',
            scopeId: projectId,
          },
        },
        create: {
          parameterKey: 'catalog.unit_categories',
          scopeType: 'project',
          scopeId: projectId,
          value: nextCatalog as unknown as Prisma.InputJsonValue,
          updatedByIdentityId: user.identityId,
        },
        update: {
          value: nextCatalog as unknown as Prisma.InputJsonValue,
          updatedByIdentityId: user.identityId,
        },
      });

      await tx.configChange.create({
        data: {
          parameterKey: 'catalog.unit_categories',
          scopeType: 'project',
          scopeId: projectId,
          oldValue: existingOverride?.value ?? Prisma.DbNull,
          newValue: nextCatalog as unknown as Prisma.InputJsonValue,
          changedByIdentityId: user.identityId,
        },
      });

      return created;
    });

    clearConfigCache();
    await logAudit({
      actorIdentityId: user.identityId,
      action: 'inventory_category:create',
      entityType: 'InventoryCategory',
      entityId: category.id,
      data: { projectId, categoryKey, name },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory category';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
