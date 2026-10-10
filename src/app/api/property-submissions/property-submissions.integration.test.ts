import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createOrganization, createUnit } from '@/test/util';

const session = { identityId: '' };
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => {
    if (!session.identityId) return null;
    const identity = await db.identity.findUnique({
      where: { id: session.identityId },
      select: { isAdmin: true, roleAssignments: {
        where: { status: 'active' },
        select: { role: true, projectId: true, unitId: true, organizationId: true, providerId: true },
      } },
    });
    return identity ? { identityId: session.identityId, isAdmin: identity.isAdmin, roles: identity.roleAssignments } : null;
  },
}));

// Keep the extraction independent of the wider pending test helper changes.
function requireRouteResponse<Args extends unknown[], Result extends Response>(
  handler: (...args: Args) => Promise<Result | undefined>,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    const response = await handler(...args);
    if (!response) throw new Error('Route handler returned no response');
    return response;
  };
}
import { GET as handleGET, POST as handlePOST, PATCH as handlePATCH } from './route';
const GET = requireRouteResponse(handleGET);
const POST = requireRouteResponse(handlePOST);
const PATCH = requireRouteResponse(handlePATCH);
import { POST as convert } from '@/app/api/admin/property-submissions/[id]/convert/route';

const req = (method: string, body?: object) => new NextRequest('http://localhost/api/property-submissions', {
  method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

async function expectHttpStatus(response: Response, expected: number) {
  const body = await response.clone().json().catch(() => null);
  expect(response.status, JSON.stringify(body)).toBe(expected);
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


  it('does not expose a live child of an unpublished project to an unrelated applicant', async () => {
    const privateProject = await createProject({ status: 'draft' });
    await createUnit({
      projectId: privateProject.id, name: 'Prematurely live',
      bedrooms: 1, maxGuests: 2, baseNightlyThb: 0, minNights: 1, status: 'live',
    });
    const response = await GET(new NextRequest(`http://localhost/api/property-submissions?projectId=${privateProject.id}`));
    await expectHttpStatus(response, 404);
  });

  it('does not expose or accept another owner’s draft unit', async () => {
    const foreign = await db.unit.create({ data: {
      projectId, name: 'Private home', unitType: 'condo', ownerIdentityId: otherId,
      bedrooms: 1, bathrooms: 1, maxGuests: 2, addressSupplement: 'Private',
      baseNightlyThb: 0, minNights: 1, status: 'draft',
    } });
    // A project-level owner label is not unit ownership or a project-wide grant.
    await db.roleAssignment.create({ data: {
      identityId: applicantId, role: 'owner', scopeType: 'project', projectId,
    } });
    const response = await GET(new NextRequest(`http://localhost/api/property-submissions?projectId=${projectId}`));
    await expectHttpStatus(response, 200);
    expect((await response.json()).units).toEqual([]);
    await expectHttpStatus(await POST(req('POST', { ...application(), existingUnitId: foreign.id })), 400);
    const draftResponse = await POST(req('POST', application()));
    await expectHttpStatus(draftResponse, 201);
    const draft = await draftResponse.json();
    await expectHttpStatus(await PATCH(req('PATCH', { id: draft.id, existingUnitId: foreign.id })), 400);
    await expectHttpStatus(await PATCH(req('PATCH', { id: draft.id, projectId: null, existingUnitId: foreign.id })), 400);
  });

  it('reuses an explicitly selected existing Unit instead of creating a duplicate', async () => {
    const existing = await createUnit({
      projectId,
      name: 'F705',
      bedrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 0,
      minNights: 1,
      status: 'live',
    });
    await db.unit.update({
      where: { id: existing.id },
      data: { unitType: 'condo', addressSupplement: 'F705' },
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
    await expectHttpStatus(response, 200);
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
  it('serializes two different applications for the same normalized physical unit', async () => {
    const applications = [];
    for (const unitName of ['บ้าน ก', 'บ้าน  ก']) {
      const response = await POST(req('POST', { ...application(), unitName, status: 'submitted' }));
      await expectHttpStatus(response, 201);
      applications.push(await response.json());
    }
    session.identityId = adminId;
    const responses = await Promise.all(applications.map(application => convert(req('POST', {
      verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true,
    }), { params: { id: application.id } })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    const rejected = responses.find(response => response.status === 400)!;
    expect((await rejected.json()).error).toContain('Possible existing property found');
    expect(await db.unit.count({ where: { projectId } })).toBe(1);
    const rows = await db.crmOpportunity.findMany({
      where: { id: { in: applications.map(application => application.id) } },
      select: { requirements: true },
    });
    expect(rows.map(row => (row.requirements as { status: string }).status).sort())
      .toEqual(['converted', 'submitted']);
  });

  it('allows the exact current owner’s private draft and rejects it after revocation', async () => {
    const privateProject = await createProject({ status: 'draft' });
    const own = await createUnit({ projectId: privateProject.id, ownerIdentityId: applicantId, status: 'draft' });
    await createUnit({ projectId: privateProject.id, ownerIdentityId: otherId, status: 'draft' });
    await db.roleAssignment.create({ data: {
      identityId: applicantId, role: 'owner', scopeType: 'unit',
      projectId: privateProject.id, unitId: own.id,
    } });
    const listing = await GET(new NextRequest(`http://localhost/api/property-submissions?projectId=${privateProject.id}`));
    await expectHttpStatus(listing, 200);
    expect((await listing.json()).units.map((unit: { id: string }) => unit.id)).toEqual([own.id]);
    const created = await POST(req('POST', {
      ...application(), projectId: privateProject.id, existingUnitId: own.id,
    }));
    await expectHttpStatus(created, 201);
    const draft = await created.json();
    await expectHttpStatus(await PATCH(req('PATCH', { id: draft.id, unitName: 'Owner update' })), 200);
    await db.roleAssignment.updateMany({ where: { identityId: applicantId }, data: { status: 'revoked' } });
    await expectHttpStatus(await GET(new NextRequest(`http://localhost/api/property-submissions?projectId=${privateProject.id}`)), 404);
    await expectHttpStatus(await PATCH(req('PATCH', { id: draft.id, unitName: 'Revoked update' })), 400);
  });

});
