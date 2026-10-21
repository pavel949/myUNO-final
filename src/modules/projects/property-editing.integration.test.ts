import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { updateUnit } from './units';
import { updateProject } from './projects';
import { PropertyEditConflict } from './edit-validation';
import { storeMedia } from '@/modules/media/media.service';
const h = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
import { PUT as putUnit } from '@/app/api/admin/units/[id]/route';
import { PATCH as patchProject } from '@/app/api/ops/projects/[id]/facts/route';
import { POST as sleeping } from '@/app/api/admin/units/[id]/property-details/route';
const request = (body: object) =>
  new NextRequest('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
let unit: Awaited<ReturnType<typeof createUnit>>;
let project: Awaited<ReturnType<typeof createProject>>;
let admin: Awaited<ReturnType<typeof createIdentity>>;
beforeEach(async () => {
  await resetDb();
  admin = await createIdentity({ isAdmin: true });
  project = await createProject();
  unit = await createUnit({ projectId: project.id });
  h.user.mockResolvedValue({ identityId: admin.id, isAdmin: true, roles: [] });
});
describe('canonical property editing', () => {
  it.each([
    { name: '' },
    { name: '  ' },
    { bedrooms: -1 },
    { bedrooms: 1.5 },
    { bathrooms: -1 },
    { maxGuests: 0 },
    { maxGuests: 1.5 },
    { sizeSqm: -1 },
    { sizeSqm: 1.5 },
    { grossAreaSqm: -1 },
    { usableAreaSqm: '10' },
    { grossAreaSqm: 1.001 },
  ])('rejects invalid physical facts %j without mutation', async (facts) => {
    const response = await putUnit(request(facts), { params: Promise.resolve({ id: unit.id }) });
    expect(response.status).toBe(400);
    expect(await db.unit.findUnique({ where: { id: unit.id } })).toEqual(unit);
  });
  it('trims names and preserves distinct area measurements', async () => {
    const r = await putUnit(
      request({
        name: '  Edited home  ',
        sizeSqm: 90,
        grossAreaSqm: 120.25,
        usableAreaSqm: 80.5,
        outdoorAreaSqm: 20,
        plotAreaSqm: null,
        expectedUpdatedAt: unit.updatedAt.toISOString(),
      }),
      { params: Promise.resolve({ id: unit.id }) }
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.name).toBe('Edited home');
    expect(Number(body.grossAreaSqm)).toBe(120.25);
    expect(Number(body.usableAreaSqm)).toBe(80.5);
    expect(body.sizeSqm).toBe(90);
  });
  it('arbitrates two concurrent stale unit writes atomically', async () => {
    const expectedUpdatedAt = unit.updatedAt.toISOString();
    const outcomes = await Promise.allSettled([
      updateUnit({ unitId: unit.id, name: 'A', expectedUpdatedAt }),
      updateUnit({ unitId: unit.id, name: 'B', expectedUpdatedAt }),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      outcomes
        .filter((x) => x.status === 'rejected')
        .map((x) => (x as PromiseRejectedResult).reason)
    ).toEqual([expect.any(PropertyEditConflict)]);
  });
  it('returns conflict to stale HTTP editors and preserves saved fields', async () => {
    await updateUnit({
      unitId: unit.id,
      name: 'Winner',
      expectedUpdatedAt: unit.updatedAt.toISOString(),
    });
    const r = await putUnit(
      request({ name: 'Stale', bathrooms: 5, expectedUpdatedAt: unit.updatedAt.toISOString() }),
      { params: Promise.resolve({ id: unit.id }) }
    );
    expect(r.status).toBe(409);
    expect((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).name).toBe('Winner');
  });
  it('saves ordinary project facts without legacy facility writes and rejects stale project edits', async () => {
    const r = await patchProject(
      request({
        name: 'Saved complex',
        address: 'Updated address',
        expectedUpdatedAt: project.updatedAt.toISOString(),
      }),
      { params: Promise.resolve({ id: project.id }) }
    );
    expect(r.status).toBe(200);
    await expect(
      updateProject({
        projectId: project.id,
        name: 'Stale',
        expectedUpdatedAt: project.updatedAt.toISOString(),
      })
    ).rejects.toBeInstanceOf(PropertyEditConflict);
    expect(await db.projectAmenity.count({ where: { projectId: project.id } })).toBe(0);
  });
  it('supports admin sleeping-space create/update/delete, prevents stale and foreign-unit updates', async () => {
    const props = { params: Promise.resolve({ id: unit.id }) };
    const payload = {
      action: 'sleeping_space',
      requestId: 'sleeping-request-test-123',
      spaceType: 'bedroom',
      beds: [{ bedType: 'double', count: 1 }],
    };
    const created = await sleeping(request(payload), props);
    expect(created.status).toBe(201);
    const space = await created.json();
    const update = {
      ...payload,
      action: 'update_sleeping_space',
      spaceId: space.id,
      expectedUpdatedAt: space.updatedAt,
      beds: [{ bedType: 'single', count: 2 }],
    };
    const saved = await sleeping(request(update), props);
    expect(saved.status).toBe(200);
    const row = await saved.json();
    expect(row.beds.map((b: any) => [b.bedType, b.count])).toEqual([['single', 2]]);
    expect((await sleeping(request(update), props)).status).toBe(409);
    const other = await createUnit({ projectId: project.id, name: 'Other' });
    expect(
      (
        await sleeping(request({ ...update, expectedUpdatedAt: row.updatedAt }), {
          params: Promise.resolve({ id: other.id }),
        })
      ).status
    ).toBe(409);
    expect(
      (
        await sleeping(
          request({
            action: 'delete_sleeping_space',
            spaceId: space.id,
            expectedUpdatedAt: row.updatedAt,
          }),
          props
        )
      ).status
    ).toBe(200);
    expect(await db.bed.count({ where: { sleepingSpaceId: space.id } })).toBe(0);
    expect((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).maxGuests).toBe(
      unit.maxGuests
    );
  });
  it('keeps sleeping changes admin-only even for factual editors', async () => {
    const staff = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: staff.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: project.id,
        status: 'active',
      },
    });
    h.user.mockResolvedValue({
      identityId: staff.id,
      isAdmin: false,
      roles: [{ role: 'staff_ops', projectId: project.id }],
    });
    expect(
      (await putUnit(request({ floor: '2' }), { params: Promise.resolve({ id: unit.id }) })).status
    ).toBe(200);
    expect(
      (
        await sleeping(
          request({
            action: 'delete_sleeping_space',
            spaceId: 'x',
            expectedUpdatedAt: new Date().toISOString(),
          }),
          { params: Promise.resolve({ id: unit.id }) }
        )
      ).status
    ).toBe(403);
  });
  it('keeps identical development uploads distinct without borrowing uploader ownership', async () => {
    for (const key of ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'VERCEL_OIDC_TOKEN'])
      vi.stubEnv(key, '');
    try {
      const input = {
        buffer: Buffer.from('synthetic bytes'),
        mimeType: 'image/png',
        kind: 'photo' as const,
        uploadedByIdentityId: admin.id,
      };
      const a = await storeMedia(db, input);
      const b = await storeMedia(db, input);
      const guest = await createIdentity();
      const c = await storeMedia(db, { ...input, uploadedByIdentityId: guest.id });
      expect(new Set([a.storageKey, b.storageKey, c.storageKey]).size).toBe(3);
      expect(c.uploadedByIdentityId).toBe(guest.id);
      expect(a.storageKey.split('#')[0]).toBe(b.storageKey.split('#')[0]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
