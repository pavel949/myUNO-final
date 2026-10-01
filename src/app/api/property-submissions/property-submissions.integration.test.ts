import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createOrganization } from '@/test/util';

const session = { identityId: '' };
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => {
    if (!session.identityId) return null;
    const identity = await db.identity.findUnique({ where: { id: session.identityId }, select: { isAdmin: true } });
    return identity ? { identityId: session.identityId, isAdmin: identity.isAdmin, roles: [] } : null;
  },
}));

import { GET, POST, PATCH } from './route';
import { POST as convert } from '@/app/api/admin/property-submissions/[id]/convert/route';

const req = (method: string, body?: object) => new NextRequest('http://localhost/api/property-submissions', {
  method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

async function expectHttpStatus(response: Response, expected: number) {
  const body = await response.clone().json().catch(() => null);
  expect({ status: response.status, body }).toMatchObject({ status: expected });
}

describe('one property intake and verified canonical conversion', () => {
  let applicantId: string, otherId: string, adminId: string, projectId: string;
  const application = () => ({
    kind: 'home', projectId, proposedProject: '', unitName: 'F705',
    bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 40, floor: '7',
    offers: ['short_stay', 'monthly', 'sale'], operatingModel: 'direct_managed', photos: [], status: 'draft',
  });

  beforeEach(async () => {
    await resetDb();
    applicantId = (await createIdentity()).id;
    otherId = (await createIdentity()).id;
    adminId = (await createIdentity({ isAdmin: true })).id;
    projectId = (await createProject({ status: 'live' })).id;
    session.identityId = applicantId;
  });

  it('requires a signed-in applicant without assigning admin permissions', async () => {
    session.identityId = '';
    expect((await POST(req('POST', application()))).status).toBe(401);
    session.identityId = applicantId;
    const result = await POST(req('POST', application()));
    expect(result.status).toBe(201);
    expect(await db.unit.count()).toBe(0);
    expect(await db.roleAssignment.count()).toBe(0);
  });

  it('restricts draft reads and writes to the applicant', async () => {
    const created = await (await POST(req('POST', application()))).json();
    session.identityId = otherId;
    expect((await (await GET(req('GET'))).json()).items).toHaveLength(0);
    expect((await PATCH(req('PATCH', { id: created.id, unitName: 'Hijacked' }))).status).toBe(404);
    expect((await db.crmOpportunity.findUniqueOrThrow({ where: { id: created.id } })).title).toBe('F705');
  });

  it('classifies owner-direct rental intake as rental CRM rather than management', async () => {
    const created = await (await POST(req('POST', {
      ...application(),
      offers: ['monthly'],
      operatingModel: 'owner_direct',
    }))).json();
    const opportunity = await db.crmOpportunity.findUniqueOrThrow({ where: { id: created.id } });
    expect(opportunity.type).toBe('rental');
  });

  it('classifies direct-managed rental intake as management CRM', async () => {
    const created = await (await POST(req('POST', {
      ...application(),
      offers: ['monthly'],
      operatingModel: 'direct_managed',
    }))).json();
    const opportunity = await db.crmOpportunity.findUniqueOrThrow({ where: { id: created.id } });
    expect(opportunity.type).toBe('management');
  });

  it('keeps a submitted application immutable to applicants', async () => {
    const created = await (await POST(req('POST', { ...application(), status: 'submitted' }))).json();
    expect((await PATCH(req('PATCH', { id: created.id, unitName: 'Changed' }))).status).toBe(409);
  });

  it('requires admin verification and atomically creates one draft unit and offerings', async () => {
    const created = await (await POST(req('POST', { ...application(), status: 'submitted' }))).json();
    expect((await convert(req('POST', { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: true }), { params: { id: created.id } })).status).toBe(403);
    session.identityId = adminId;
    expect((await convert(req('POST', { verifiedAuthority: false, checkedDuplicates: true, checkedMedia: true }), { params: { id: created.id } })).status).toBe(400);
    const response = await convert(req('POST', { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: true }), { params: { id: created.id } });
    await expectHttpStatus(response, 200);
    const result = await response.json();
    const unit = await db.unit.findUniqueOrThrow({ where: { id: result.unitId }, include: { commercialOfferings: true } });
    expect(unit.projectId).toBe(projectId);
    expect(unit.status).toBe('draft');
    expect(unit.ownerIdentityId).toBe(applicantId);
    expect(unit.commercialOfferings.map(o => [o.offeringType, o.status])).toEqual(expect.arrayContaining([['short_term_stay', 'draft'], ['long_term_rental', 'draft'], ['sale', 'draft']]));
    expect(unit.commercialOfferings).toHaveLength(3);
    const engagement = await db.unitEngagement.findFirstOrThrow({ where: { unitId: unit.id } });
    expect(engagement.engagementType).toBe('direct_managed');
    expect(engagement.status).toBe('draft');
    expect(engagement.ownerIdentityId).toBe(applicantId);
    expect(await db.ownershipPeriod.count({ where: { unitId: unit.id } })).toBe(1);
    expect(await db.roleAssignment.count({ where: { identityId: applicantId, role: 'owner', unitId: unit.id } })).toBe(1);
    const retry = await (await convert(req('POST', { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true }), { params: { id: created.id } })).json();
    expect(retry.unitId).toBe(unit.id);
    expect(await db.unit.count({ where: { projectId } })).toBe(1);
  });

  it('creates a new draft complex independently of its future units', async () => {
    const area = await db.area.create({ data: { slug: 'test-area', nameKey: 'area.test', status: 'live', sort: 1 } });
    const created = await (await POST(req('POST', {
      kind: 'resort', proposedProject: 'New Bay Resort', projectAddress: '101 Bay Road',
      projectType: 'resort', areaId: area.id, latitude: 7.99, longitude: 98.32,
      unitName: '', photos: [], projectPhotos: [], offers: [], status: 'submitted',
    }))).json();
    session.identityId = adminId;
    const response = await convert(req('POST', { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true }), { params: { id: created.id } });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.unitId).toBeNull();
    const project = await db.project.findUniqueOrThrow({ where: { id: result.projectId } });
    expect(project.status).toBe('draft');
    expect(project.name).toBe('New Bay Resort');
    expect(await db.unit.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('records the management relationship without granting company membership to the owner', async () => {
    const org = await createOrganization('Approved MC', projectId);
    const created = await (await POST(req('POST', { ...application(), kind: 'management', operatingModel: 'via_management_company', unitName: 'F706', status: 'submitted' }))).json();
    session.identityId = adminId;
    const response = await convert(req('POST', {
      verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: true, organizationId: org.id,
    }), { params: { id: created.id } });
    await expectHttpStatus(response, 200);
    const { unitId } = await response.json();
    expect((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).ownerIdentityId).toBe(applicantId);
    expect(await db.roleAssignment.count({ where: { identityId: applicantId, role: 'mc_member' } })).toBe(0);
    const engagement = await db.unitEngagement.findFirstOrThrow({ where: { unitId } });
    expect(engagement.engagementType).toBe('via_management_company');
    expect(engagement.managementOrgId).toBe(org.id);
    expect(engagement.status).toBe('draft');
  });


  it('reuses an explicitly selected existing Unit instead of creating a duplicate', async () => {
    const existing = await db.unit.create({
      data: {
        projectId,
        name: 'F705',
        unitType: 'condo',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        addressSupplement: 'F705',
        baseNightlyThb: 0,
        minNights: 1,
        status: 'draft',
      },
    });
    const created = await (await POST(req('POST', {
      ...application(),
      existingUnitId: existing.id,
      status: 'submitted',
    }))).json();

    session.identityId = adminId;
    const response = await convert(req('POST', {
      verifiedAuthority: true,
      checkedDuplicates: true,
      checkedMedia: true,
      verifiedOwner: true,
    }), { params: { id: created.id } });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.unitId).toBe(existing.id);
    expect(await db.unit.count({ where: { projectId } })).toBe(1);
    expect((await db.unit.findUniqueOrThrow({ where: { id: existing.id } })).ownerIdentityId).toBe(applicantId);
    expect(await db.ownershipPeriod.count({ where: { unitId: existing.id } })).toBe(1);
  });

  it('does not create duplicate physical units in the same complex', async () => {
    await db.unit.create({ data: { projectId, name: 'F705', unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2, addressSupplement: 'F705', baseNightlyThb: 0, minNights: 1, status: 'draft' } });
    const created = await (await POST(req('POST', { ...application(), status: 'submitted' }))).json();
    session.identityId = adminId;
    const response = await convert(req('POST', { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true }), { params: { id: created.id } });
    expect(response.status).toBe(400);
    expect(await db.unit.count({ where: { projectId } })).toBe(1);
  });
});
