/** Real PostgreSQL contract. Requires a separately provisioned, migrated LOCAL
 * DATABASE_URL_TEST. No production access, schema change or automatic retry.
 * Fake-Prisma tests do not substitute for running this suite. */
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createEmployeeCreationService, employeeCreationForConversionTx, hasEmployeeCreatedTargetAccessTx } from './employee-creation.service';
import { createContentProposalService } from './content-proposal.service';

// Only authentication/session and the application DB singleton are redirected.
// Canonical conversion, media, receipt and database transaction code stay real.
const conversionRuntime = vi.hoisted(() => ({ db: null as unknown as PrismaClient, reviewer: '', author: '' }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_target, name) => Reflect.get(conversionRuntime.db, name) }) }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAdmin: async () => ({ ok: true, actorIdentityId: conversionRuntime.reviewer }) }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: conversionRuntime.author, isAdmin: false }) }));
let convert: typeof import('@/app/api/admin/property-submissions/[id]/convert/route')['POST'];
let ownerList: typeof import('@/app/api/property-submissions/route')['GET'];
const conversionRequest = (body: unknown) => ({ json: async () => body }) as Parameters<typeof convert>[0];
const adminConvert = (id: string, overrides: Record<string, unknown> = {}) => convert(conversionRequest({
  verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false, ...overrides,
}), { params: { id } });
let db: PrismaClient;
let fixtures: typeof import('@/test/util');
let service: ReturnType<typeof createEmployeeCreationService>;
let author: string, reviewer: string, projectId: string, unitId: string, organizationId: string, spaceId: string, memberId: string, attachmentId: string, roleId: string;
const serial = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const input = (status: 'draft' | 'submitted' = 'submitted') => ({ requestId: randomUUID(), spaceId, kind: 'unit', projectId, status,
  draft: { unitName: 'New physical unit', unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2 } });
const row = (id: string) => db.crmOpportunity.findUniqueOrThrow({ where: { id } });
const checkConversion = async (id: string) => db.$transaction(async tx => employeeCreationForConversionTx(tx, await tx.crmOpportunity.findUniqueOrThrow({ where: { id } }), reviewer,
  { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false }), serial);

describe('employee creation PostgreSQL authority, idempotency and atomicity', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://missing');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname) ||
      !/(?:^|[_-])test(?:[_-]|$)/i.test(url.pathname.slice(1))) throw new Error('Employee creation tests require a local dedicated test database');
    fixtures = await import('@/test/util'); db = fixtures.db; service = createEmployeeCreationService(db);
    conversionRuntime.db = db;
    convert = (await import('@/app/api/admin/property-submissions/[id]/convert/route')).POST;
    ownerList = (await import('@/app/api/property-submissions/route')).GET;
  });
  beforeEach(async () => {
    await fixtures.resetDb();
    author = (await fixtures.createIdentity()).id; reviewer = (await fixtures.createIdentity({ isAdmin: true })).id;
    conversionRuntime.author = author; conversionRuntime.reviewer = reviewer; conversionRuntime.db = db;
    projectId = (await fixtures.createProject()).id; unitId = (await fixtures.createUnit({ projectId })).id;
    organizationId = (await db.organization.create({ data: { name: 'Employee creation operator', orgType: 'management_company', contactEmail: 'operator@example.test', contactPhone: '+66000000000' } })).id;
    roleId = (await db.projectOrganizationRole.create({ data: { projectId, organizationId, roleKey: 'operator', provenance: 'verified' } })).id;
    spaceId = (await db.operatingSpace.create({ data: { key: `creation-${randomUUID()}`, name: 'Existing eligible space', organizationId } })).id;
    attachmentId = (await db.operatingSpaceUnit.create({ data: { operatingSpaceId: spaceId, unitId, startsOn: new Date(Date.now() - 86400000) } })).id;
    memberId = (await db.operatingSpaceMember.create({ data: { operatingSpaceId: spaceId, identityId: author, capabilities: ['create_unit', 'create_complex'] } })).id;
  });
  it('concurrent same-ID commands persist exactly one intake and audit, then read back the committed result', async () => {
    const body = input();
    const outcomes = await Promise.allSettled([service.create(author, body), service.create(author, body)]);
    expect(outcomes.filter(result => result.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await db.crmOpportunity.count({ where: { identityId: author } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'employee_creation.created' } })).toBe(1);
    const recovered = await service.byRequest(author, body.requestId);
    expect(recovered.item).not.toBeNull(); expect(recovered.requestReceipt?.revision).toBe(1);
    expect((await service.create(author, body)).id).toBe(recovered.item!.id);
    expect(await db.unit.count()).toBe(1); expect(await db.roleAssignment.count()).toBe(0);
  });
  it('concurrent saves enforce CAS and preserve the winning request receipt', async () => {
    const draft = await service.create(author, input('draft'));
    const bodies = [1, 2].map(index => ({ id: draft.id, requestId: randomUUID(), expectedRevision: 1, status: 'draft', draft: { ...draft.draft, unitName: `Candidate ${index}` } }));
    const outcomes = await Promise.allSettled(bodies.map(body => service.update(author, body)));
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await service.get(author, draft.id)).revision).toBe(2);
    expect(await db.auditLog.count({ where: { action: 'employee_creation.saved' } })).toBe(1);
  });
  it.each(['capability', 'member', 'space', 'organization', 'identity', 'attachment', 'operator-role'] as const)('revocation of %s blocks save and conversion, preserving the creator intake only when active', async what => {
    const draft = await service.create(author, input('draft'));
    if (what === 'capability') await db.operatingSpaceMember.update({ where: { id: memberId }, data: { capabilities: [] } });
    if (what === 'member') await db.operatingSpaceMember.update({ where: { id: memberId }, data: { active: false } });
    if (what === 'space') await db.operatingSpace.update({ where: { id: spaceId }, data: { status: 'inactive' } });
    if (what === 'organization') await db.organization.update({ where: { id: organizationId }, data: { status: 'suspended' } });
    if (what === 'identity') await db.identity.update({ where: { id: author }, data: { status: 'blocked' } });
    if (what === 'attachment') await db.operatingSpaceUnit.update({ where: { id: attachmentId }, data: { active: false } });
    if (what === 'operator-role') await db.projectOrganizationRole.update({ where: { id: roleId }, data: { effectiveTo: new Date(Date.now() - 1000) } });
    await expect(service.update(author, { id: draft.id, requestId: randomUUID(), expectedRevision: 1, status: 'submitted', draft: draft.draft })).rejects.toMatchObject({ status: 403 });
    await expect(checkConversion(draft.id)).rejects.toMatchObject({ status: 403 });
    if (what === 'identity') await expect(service.get(author, draft.id)).rejects.toMatchObject({ status: 403 });
    else expect(await service.get(author, draft.id)).toMatchObject({ mayEdit: false, hasCreationAccess: false, createdUnitId: null, createdProjectId: null, draft: draft.draft });
  });
  it.each(['member', 'organization', 'identity', 'attachment', 'operator-role'] as const)('holds real authority row locks against concurrent %s revocation', async what => {
    let announce!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { announce = resolve; }), released = new Promise<void>(resolve => { release = resolve; });
    let paused = false;
    const pausingDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) => target.$transaction(async tx => run(new Proxy(tx, { get(inner, name) {
        if (name === '$queryRaw') return async (parts: TemplateStringsArray, ...values: unknown[]) => {
          const result = await inner.$queryRaw(parts, ...values);
          if (!paused && parts.join('?').includes('FROM project_organization_role')) { paused = true; announce(); await released; }
          return result;
        };
        return Reflect.get(inner, name);
      } })), options);
      return Reflect.get(target, property);
    } });
    const creation = createEmployeeCreationService(pausingDb).create(author, input());
    await Promise.race([locked, creation.then(() => { throw new Error('Missing lock checkpoint'); })]);
    let announcePid!: (pid: number) => void;
    const pidReady = new Promise<number>(resolve => { announcePid = resolve; });
    const revocation = db.$transaction(async tx => {
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`; announcePid(connection.pid);
      if (what === 'member') return tx.operatingSpaceMember.update({ where: { id: memberId }, data: { capabilities: [] } });
      if (what === 'organization') return tx.organization.update({ where: { id: organizationId }, data: { status: 'suspended' } });
      if (what === 'identity') return tx.identity.update({ where: { id: author }, data: { status: 'blocked' } });
      if (what === 'attachment') return tx.operatingSpaceUnit.update({ where: { id: attachmentId }, data: { active: false } });
      return tx.projectOrganizationRole.update({ where: { id: roleId }, data: { provenance: 'unverified' } });
    });
    const finished = Promise.allSettled([creation, revocation]); let observed = false;
    try {
      const pid = await pidReady, deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const activity = await db.$queryRaw<{ wait_event_type: string | null }[]>`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
        if (activity[0]?.wait_event_type === 'Lock') { observed = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { release(); await finished; }
    expect(observed).toBe(true); await revocation;
    const created = await creation;
    await expect(checkConversion(created.id)).rejects.toMatchObject({ status: 403 });
  });
  it('rolls back the entire intake if audit persistence fails', async () => {
    const broken = db.$extends({ query: { auditLog: { async create({ args, query }) {
      if (args.data.action === 'employee_creation.created') throw new Error('TEST_AUDIT_UNAVAILABLE'); return query(args);
    } } } }) as unknown as PrismaClient;
    await expect(createEmployeeCreationService(broken).create(author, input())).rejects.toThrow('TEST_AUDIT_UNAVAILABLE');
    expect(await db.crmOpportunity.count()).toBe(0); expect(await db.auditLog.count()).toBe(0);
  });
  it('receipt-created DRAFT content uses the canonical proposal workflow and blocks revoked author at approval', async () => {
    const draft = await service.create(author, input());
    const response = await adminConvert(draft.id); expect(response.status).toBe(200);
    const converted = await response.json();
    const created = await db.unit.findUniqueOrThrow({ where: { id: converted.unitId } });
    expect(await db.$transaction(tx => hasEmployeeCreatedTargetAccessTx(tx, author, { scope: 'unit', id: created.id, projectId }), serial)).toBe(true);
    const content = createContentProposalService(db), baseline = await content.target(author, 'unit', created.id);
    const proposal = await content.create(author, { scope: 'unit', targetId: created.id, baselineVersion: baseline.baselineVersion, status: 'submitted',
      proposal: { facts: { ...baseline.snapshot.facts, name: 'Awaiting review' }, description: null, gallery: { mediaIds: [], coverMediaId: null } } });
    await db.operatingSpaceMember.update({ where: { id: memberId }, data: { capabilities: [] } });
    await expect(content.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    expect((await db.unit.findUniqueOrThrow({ where: { id: created.id } })).name).toBe('New physical unit');
    expect(await service.get(author, draft.id)).toMatchObject({ createdUnitId: null, hasCreationAccess: false });
  });
  it('actual conversion hands a newly created DRAFT unit into successful canonical content review without operational rights', async () => {
    const draft = await service.create(author, input());
    const response = await adminConvert(draft.id); expect(response.status).toBe(200);
    const converted = await response.json();
    const content = createContentProposalService(db), baseline = await content.target(author, 'unit', converted.unitId);
    const proposal = await content.create(author, { scope: 'unit', targetId: converted.unitId, baselineVersion: baseline.baselineVersion, status: 'submitted',
      proposal: { facts: { ...baseline.snapshot.facts, name: 'Reviewed created home' }, description: { locale: 'en', value: 'Reviewed descriptive content' },
        gallery: { mediaIds: [], coverMediaId: null } } });
    expect(await content.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).toMatchObject({ status: 'approved', alreadyApproved: false });
    const canonical = await db.unit.findUniqueOrThrow({ where: { id: converted.unitId } });
    expect(canonical).toMatchObject({ name: 'Reviewed created home', status: 'draft', ownerIdentityId: null, instantBook: false, baseNightlyThb: 0 });
    expect(await db.translation.findFirst({ where: { contentKey: { key: canonical.descriptionKey! }, locale: 'en' } })).toMatchObject({ value: 'Reviewed descriptive content', status: 'needs_review' });
    expect(await db.operatingSpaceUnit.count()).toBe(1); expect(await db.roleAssignment.count()).toBe(0); expect(await db.unitEngagement.count()).toBe(0); expect(await db.commercialOffering.count()).toBe(0);
  });
  it('actual admin conversion races two different unit intakes without duplicate physical inventory', async () => {
    const first = await service.create(author, input()), second = await service.create(author, input());
    const responses = await Promise.all([adminConvert(first.id), adminConvert(second.id)]);
    expect(responses.filter(response => response.status === 200)).toHaveLength(1);
    expect(responses.filter(response => [400, 409].includes(response.status))).toHaveLength(1);
    expect(await db.unit.count({ where: { projectId, name: 'New physical unit' } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'property_submission:convert' } })).toBe(1);
    expect(await db.operatingSpaceUnit.count()).toBe(1);
    expect(await db.roleAssignment.count()).toBe(0); expect(await db.commercialOffering.count()).toBe(0);
  });
  it.each(['name', 'address'] as const)('actual conversion serializes different complex applications sharing a %s', async duplicate => {
    const area = await db.area.create({ data: { slug: `test-${randomUUID()}`, nameKey: 'test.area', status: 'live' } });
    const firstInput = { requestId: randomUUID(), spaceId, kind: 'complex', projectId: null, status: 'submitted',
      draft: { proposedProject: 'Duplicate complex', projectAddress: 'New address 1', areaId: area.id, latitude: 7.8, longitude: 98.3 } };
    const secondInput = { ...firstInput, requestId: randomUUID(), draft: { ...firstInput.draft,
      ...(duplicate === 'name' ? { projectAddress: 'New address 2' } : { proposedProject: 'Other name' }) } };
    const first = await service.create(author, firstInput), second = await service.create(author, secondInput);
    const responses = await Promise.all([adminConvert(first.id), adminConvert(second.id)]);
    expect(responses.filter(response => response.status === 200)).toHaveLength(1);
    expect(responses.filter(response => [400, 409].includes(response.status))).toHaveLength(1);
    expect(await db.project.count()).toBe(2); expect(await db.unit.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'property_submission:convert' } })).toBe(1);
  });
  it('actual conversion resolves an admin-selected existing unit without changing any canonical rows or rights', async () => {
    const uploaded = await db.mediaAsset.create({ data: { storageKey: `https://example.test/${randomUUID()}.jpg`, kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 42, uploadedByIdentityId: author } });
    const body = input();
    const draft = await service.create(author, { ...body, draft: { ...body.draft, photos: [uploaded.id], description: 'Employee suggested description', descriptionLocale: 'en' } });
    const snapshot = async () => ({ unit: await db.unit.findUniqueOrThrow({ where: { id: unitId } }), media: await db.unitMedia.findMany({ where: { unitId } }),
      owners: await db.ownershipPeriod.findMany({ where: { unitId } }), offerings: await db.commercialOffering.findMany({ where: { unitId } }),
      engagements: await db.unitEngagement.findMany({ where: { unitId } }), roles: await db.roleAssignment.findMany(), attachments: await db.operatingSpaceUnit.findMany(), keys: await db.contentKey.findMany() });
    const before = await snapshot();
    const response = await adminConvert(draft.id, { existingUnitId: unitId }); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ unitId, createdProjectId: null, createdUnitId: null, matchedExisting: true });
    expect(await snapshot()).toEqual(before);
    expect(await db.$transaction(tx => hasEmployeeCreatedTargetAccessTx(tx, author, { scope: 'unit', id: unitId, projectId }), serial)).toBe(false);
    expect((await adminConvert(draft.id)).status).toBe(200);
    expect(await db.auditLog.count({ where: { entityId: draft.id, action: 'property_submission:convert' } })).toBe(1);
  });
  it('actual conversion rolls back a new Project, descriptions and receipt when final audit fails', async () => {
    const area = await db.area.create({ data: { slug: `test-${randomUUID()}`, nameKey: 'test.area', status: 'live' } });
    const draft = await service.create(author, { requestId: randomUUID(), spaceId, kind: 'complex', projectId: null, status: 'submitted',
      draft: { proposedProject: 'Rollback complex', projectAddress: 'Rollback address', areaId: area.id, latitude: 7.8, longitude: 98.3, description: 'Rollback copy', descriptionLocale: 'en' } });
    const before = await row(draft.id), projectCount = await db.project.count(), keyCount = await db.contentKey.count();
    const broken = db.$extends({ query: { auditLog: { async create({ args, query }) {
      if (args.data.action === 'property_submission:convert') throw new Error('TEST_AUDIT_UNAVAILABLE'); return query(args);
    } } } }) as unknown as PrismaClient;
    conversionRuntime.db = broken;
    try { expect((await adminConvert(draft.id)).status).toBe(500); }
    finally { conversionRuntime.db = db; }
    expect(await row(draft.id)).toEqual(before); expect(await db.project.count()).toBe(projectCount); expect(await db.contentKey.count()).toBe(keyCount);
    expect(await db.auditLog.count({ where: { action: 'property_submission:convert' } })).toBe(0);
  });
  it('real owner intake listing excludes employee keys before its 50-row page', async () => {
    const owner = await db.crmOpportunity.create({ data: { identityId: author, type: 'management', title: 'Older owner intake', source: 'myuno_property_submission_v1', requirements: { kind: 'home', status: 'draft' } } });
    await db.crmOpportunity.createMany({ data: Array.from({ length: 51 }, (_, index) => ({ identityId: author, type: 'management' as const, title: `Employee marker ${index}`, source: 'myuno_property_submission_v1', requirements: { employeeCreation: null } })) });
    const response = await ownerList({ nextUrl: { searchParams: new URLSearchParams() } } as Parameters<typeof ownerList>[0]);
    expect((await response.json()).items.map((item: { id: string }) => item.id)).toEqual([owner.id]);
  });

});
