import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as createCategory } from './route';
import { PATCH as updateCategory } from './[categoryId]/route';
import { PATCH as assignUnitCategory } from '@/app/api/admin/units/[id]/inventory-category/route';

function adminUser(identity: { id: string; email: string | null }) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    roles: [],
  };
}

describe('canonical inventory category admin writes', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates a category together with its master BAR and project catalog entry', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const response = await createCategory(
      new NextRequest('http://localhost/api/admin/inventory-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          categoryKey: 'layantara_signature_3br',
          name: 'Layantara Signature 3BR',
          bedrooms: 3,
          bathrooms: 3,
          maxGuests: 6,
          baseNightlyThb: 1_250_000,
          minNights: 2,
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();

    const [category, bar, catalogOverride] = await Promise.all([
      db.inventoryCategory.findUnique({ where: { id: body.category.id } }),
      db.ratePlan.findFirst({
        where: {
          categoryId: body.category.id,
          code: 'BAR',
          isMaster: true,
          status: 'active',
        },
      }),
      db.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'catalog.unit_categories',
            scopeType: 'project',
            scopeId: project.id,
          },
        },
      }),
    ]);

    expect(category).toMatchObject({
      projectId: project.id,
      categoryKey: 'layantara_signature_3br',
      baseNightlyThb: 1_250_000,
      minNights: 2,
    });
    expect(bar).toMatchObject({
      code: 'BAR',
      isMaster: true,
      minNights: 2,
      status: 'active',
    });
    expect(catalogOverride?.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'layantara_signature_3br', bedrooms: 3 }),
      ])
    );
  });

  it('assigns a villa to the category and keeps category, BAR and unit mirrors coherent on pricing changes', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'draft',
      baseNightlyThb: 500_000,
      minNights: 1,
    });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const createResponse = await createCategory(
      new NextRequest('http://localhost/api/admin/inventory-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          categoryKey: 'layantara_premium_2br',
          name: 'Layantara Premium 2BR',
          bedrooms: 2,
          bathrooms: 2,
          maxGuests: 4,
          baseNightlyThb: 900_000,
          minNights: 2,
        }),
      })
    );
    const created = await createResponse.json();
    const categoryId = created.category.id as string;

    const assignResponse = await assignUnitCategory(
      new NextRequest(`http://localhost/api/admin/units/${unit.id}/inventory-category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      }),
      { params: { id: unit.id } }
    );
    expect(assignResponse.status).toBe(200);

    let linkedUnit = await db.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(linkedUnit.inventoryCategoryId).toBe(categoryId);
    expect(linkedUnit.categoryKey).toBe('layantara_premium_2br');
    expect(linkedUnit.baseNightlyThb).toBe(900_000);
    expect(linkedUnit.minNights).toBe(2);

    const updateResponse = await updateCategory(
      new NextRequest(`http://localhost/api/admin/inventory-categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseNightlyThb: 1_050_000,
          minNights: 4,
        }),
      }),
      { params: { categoryId } }
    );
    expect(updateResponse.status).toBe(200);

    const [category, bar] = await Promise.all([
      db.inventoryCategory.findUniqueOrThrow({ where: { id: categoryId } }),
      db.ratePlan.findFirstOrThrow({
        where: { categoryId, code: 'BAR', isMaster: true, status: 'active' },
      }),
    ]);
    linkedUnit = await db.unit.findUniqueOrThrow({ where: { id: unit.id } });

    expect(category.baseNightlyThb).toBe(1_050_000);
    expect(category.minNights).toBe(4);
    expect(bar.minNights).toBe(4);
    expect(linkedUnit.baseNightlyThb).toBe(1_050_000);
    expect(linkedUnit.minNights).toBe(4);
  });

  it('rejects master inventory writes from non-admin users', async () => {
    const identity = await createIdentity();
    const project = await createProject();
    mockGetCurrentUser.mockResolvedValue({
      ...adminUser(identity),
      isAdmin: false,
    });

    const response = await createCategory(
      new NextRequest('http://localhost/api/admin/inventory-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          categoryKey: 'forbidden_category',
          name: 'Forbidden Category',
          bedrooms: 2,
          bathrooms: 2,
          maxGuests: 4,
          baseNightlyThb: 800_000,
          minNights: 1,
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(await db.inventoryCategory.count()).toBe(0);
  });
});
