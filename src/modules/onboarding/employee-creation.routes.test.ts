import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeHarness } from './employee-creation.test-support';
const runtime = vi.hoisted(() => ({ db: null as any, actorId: 'reviewer' }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_target, name) => runtime.db[name] }) }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAdmin: async () => ({ ok: true, actorIdentityId: runtime.actorId }) }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'author', isAdmin: false }) }));
vi.mock('@/modules/projects', () => ({ setUnitOwnerTx: vi.fn() }));
vi.mock('@/modules/core', () => ({ createDraftUnitEngagementTx: vi.fn() }));
vi.mock('@/modules/onboarding', async () => { const canonical = await import('./canonical-onboarding'); return { ...canonical, deriveUnitOnboardingState: async () => ({ state: 'draft', blockers: [] }) }; });
import { POST as convert } from '@/app/api/admin/property-submissions/[id]/convert/route';
import { PATCH as genericPatch } from '@/app/api/crm/opportunities/[id]/route';
import { GET as ownerList, POST as ownerCreate, PATCH as ownerPatch } from '@/app/api/property-submissions/route';
import { setUnitOwnerTx } from '@/modules/projects';
import { createDraftUnitEngagementTx } from '@/modules/core';
import { getEmployeeCreationReviewOptions } from './employee-creation.service';
const review = { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false };
const req = (body: unknown) => ({ json: async () => body, nextUrl: { searchParams: new URLSearchParams() } }) as any;
describe('employee conversion and alternate writer routes (fake Prisma)', () => {
  let h: ReturnType<typeof employeeHarness>;
  beforeEach(() => { h = employeeHarness(); runtime.db = h.db; runtime.actorId = 'reviewer'; vi.clearAllMocks(); });
  it('creates only a DRAFT unit, stamps exact output, and keeps owner/mandate/operating/offerings untouched', async () => {
    const draft = await h.service.create('author', h.unitInput());
    const response = await convert(req(review), { params: { id: draft.id } });
    expect(response.status).toBe(200);
    const converted = await response.json();
    expect(converted).toMatchObject({ projectId: 'project', alreadyConverted: false });
    const created = h.state().units.find((unit: any) => unit.id === converted.unitId);
    expect(created).toMatchObject({ status: 'draft', instantBook: false, baseNightlyThb: 0, minNights: 1 });
    expect(h.state().rows[0].requirements.employeeCreation.createdUnitId).toBe(created.id);
    expect(h.state().rows[0].requirements.employeeCreation.createdProjectId).toBeNull();
    expect(h.db.commercialOffering.upsert).not.toHaveBeenCalled();
    expect(setUnitOwnerTx).not.toHaveBeenCalled(); expect(createDraftUnitEngagementTx).not.toHaveBeenCalled();
    expect(h.state().attachments).toHaveLength(1);
    const again = await convert(req(review), { params: { id: draft.id } });
    expect(await again.json()).toMatchObject({ unitId: created.id, alreadyConverted: true });
    expect(h.state().units).toHaveLength(2);
  });
  it('matching an existing unit cannot mutate its complete row, gallery, ownership, offering or engagement', async () => {
    h.state().assets.push({ id: 'photo', uploadedByIdentityId: 'author', kind: 'photo', encrypted: false, sizeBytes: 42, mimeType: 'image/jpeg', deleteAfter: null });
    const before = structuredClone(h.state().units[0]);
    const input = h.unitInput({ draft: { ...h.unitInput().draft, existingUnitId: 'attached', photos: ['photo'], description: 'Ignored existing text', descriptionLocale: 'en' } });
    const draft = await h.service.create('author', input);
    const response = await convert(req(review), { params: { id: draft.id } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ unitId: 'attached' });
    expect(h.state().units).toEqual([before]); expect(h.state().unitMedia).toHaveLength(0); expect(h.state().keys).toHaveLength(0);
    expect(h.state().rows[0].requirements.employeeCreation.createdUnitId).toBeNull();
    expect(h.db.unit.update).not.toHaveBeenCalled(); expect(h.db.commercialOffering.upsert).not.toHaveBeenCalled();
    expect(setUnitOwnerTx).not.toHaveBeenCalled(); expect(createDraftUnitEngagementTx).not.toHaveBeenCalled();
  });
  it('admin can resolve a duplicate to an eligible existing unit without rewriting original intake', async () => {
    const draft = await h.service.create('author', h.unitInput());
    expect(await getEmployeeCreationReviewOptions(h.db, 'reviewer', draft.id)).toEqual({ units: [{ id: 'attached', name: 'A101', projectId: 'project' }], projects: [] });
    const original = structuredClone(h.state().units[0]);
    const response = await convert(req({ ...review, existingUnitId: 'attached' }), { params: { id: draft.id } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ unitId: 'attached', createdUnitId: null, createdProjectId: null, matchedExisting: true });
    expect(h.state().units).toEqual([original]);
    expect(h.state().rows[0].requirements.existingUnitId).toBeNull();
    const again = await convert(req(review), { params: { id: draft.id } });
    expect(await again.json()).toMatchObject({ unitId: 'attached', createdUnitId: null, matchedExisting: true, alreadyConverted: true });
  });
  it('rejects admin match to an unattached sibling, foreign project or a complex-to-unit target', async () => {
    h.state().units.push({ ...h.state().units[0], id: 'sibling' });
    const draft = await h.service.create('author', h.unitInput());
    expect((await convert(req({ ...review, existingUnitId: 'sibling' }), { params: { id: draft.id } })).status).toBe(403);
    const complex = await h.service.create('author', h.complexInput({ requestId: '00000000-0000-4000-8000-000000000099' }));
    expect((await convert(req({ ...review, existingUnitId: 'attached' }), { params: { id: complex.id } })).status).toBe(403);
    await expect(getEmployeeCreationReviewOptions(h.db, 'author', draft.id)).rejects.toMatchObject({ status: 403 });
  });
  it('complex-only conversion never creates a home and stamps only a new Project receipt', async () => {
    h.state().members[0].capabilities = ['create_complex'];
    const draft = await h.service.create('author', h.complexInput());
    const response = await convert(req(review), { params: { id: draft.id } });
    expect(response.status).toBe(200); const result = await response.json();
    expect(result.unitId).toBeNull(); expect(h.state().units).toHaveLength(1);
    expect(h.state().projects.find((project: any) => project.id === result.projectId).status).toBe('draft');
    expect(h.state().rows[0].requirements.employeeCreation).toMatchObject({ createdProjectId: result.projectId, createdUnitId: null });
    const keys = h.db.$queryRaw.mock.calls.filter((call: any) => call[0].join('?').includes('pg_advisory_xact_lock')).map((call: any) => call[1]);
    expect(keys).toContain('project-name:new complex'); expect(keys).toContain('project-address:new address');
  });
  it('complex match grants no existing Project right or mutation', async () => {
    const draft = await h.service.create('author', h.complexInput()), before = structuredClone(h.state().projects);
    const response = await convert(req({ ...review, projectId: 'project' }), { params: { id: draft.id } });
    expect(response.status).toBe(200); expect(h.state().projects).toEqual(before);
    expect(h.state().rows[0].requirements.employeeCreation.createdProjectId).toBeNull();
  });
  it('rechecks revocation before conversion and before a converted idempotent response', async () => {
    const draft = await h.service.create('author', h.unitInput());
    h.state().members[0].active = false;
    expect((await convert(req(review), { params: { id: draft.id } })).status).toBe(403);
    h.state().members[0].active = true;
    expect((await convert(req(review), { params: { id: draft.id } })).status).toBe(200);
    h.state().members[0].active = false;
    expect((await convert(req(review), { params: { id: draft.id } })).status).toBe(403);
    expect(h.state().units).toHaveLength(2);
  });
  it('refuses malformed marker instead of falling into owner conversion', async () => {
    const draft = await h.service.create('author', h.unitInput()); h.state().rows[0].requirements.employeeCreation = null;
    const response = await convert(req(review), { params: { id: draft.id } });
    expect(response.status).toBe(409); expect(h.state().units).toHaveLength(1);
  });
  it('public intake hides employee rows and refuses injection or mutation', async () => {
    const draft = await h.service.create('author', h.unitInput({ status: 'draft' }));
    expect((await (await ownerList(req(null))).json()).items).toEqual([]);
    expect((await ownerPatch(req({ id: draft.id, unitName: 'Changed' }))).status).toBe(403);
    expect((await ownerCreate(req({ kind: 'home', employeeCreation: {} }))).status).toBe(400);
  });
  it('filters employee markers before owner pagination, including malformed markers', async () => {
    for (let index = 0; index < 51; index++) h.state().rows.push({ id: `employee-${index}`, identityId: 'author', source: 'myuno_property_submission_v1', requirements: { employeeCreation: index % 2 ? null : {} } });
    h.state().rows.push({ id: 'older-owner-draft', identityId: 'author', source: 'myuno_property_submission_v1', requirements: { kind: 'home', status: 'draft' } });
    const response = await ownerList(req(null));
    expect((await response.json()).items.map((item: any) => item.id)).toEqual(['older-owner-draft']);
  });
  it('explicit null reviewer match clears the intake match but never bypasses canonical duplicate checks', async () => {
    const draft = await h.service.create('author', h.unitInput({ draft: { ...h.unitInput().draft, existingUnitId: 'attached' } }));
    const response = await convert(req({ ...review, existingUnitId: null }), { params: { id: draft.id } });
    expect(response.status).toBe(200); const result = await response.json();
    expect(result.unitId).not.toBe('attached'); expect(result.createdUnitId).toBe(result.unitId);
    expect(h.state().rows[0].requirements.existingUnitId).toBe('attached');
  });
  it('generic CRM cannot remove, replace, or inject receipts and locks before checking', async () => {
    const draft = await h.service.create('author', h.unitInput());
    expect((await genericPatch(req({ requirements: {} }), { params: { id: draft.id } })).status).toBe(403);
    h.state().rows.push({ id: 'ordinary', identityId: 'author', source: 'ordinary', requirements: {} });
    expect((await genericPatch(req({ requirements: { employeeCreation: {} } }), { params: { id: 'ordinary' } })).status).toBe(400);
    expect((await genericPatch(req({ requirements: { note: 'Routine CRM edit' } }), { params: { id: 'ordinary' } })).status).toBe(200);
    expect(h.db.$queryRaw.mock.calls.some((call: any) => call[0].join('?').includes('crm_opportunity') && call[0].join('?').includes('FOR UPDATE'))).toBe(true);
  });
  it('ordinary public-owner intake still creates and converts a canonical DRAFT', async () => {
    const response = await ownerCreate(req({ kind: 'home', unitName: 'Owner new home', projectId: 'project', unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2,
      offers: ['short_stay'], status: 'submitted' }));
    expect(response.status).toBe(201); const draft = await response.json();
    expect(draft.requirements.employeeCreation).toBeUndefined();
    expect((await convert(req({ ...review, verifiedOwner: true }), { params: { id: draft.id } })).status).toBe(200);
    expect(setUnitOwnerTx).toHaveBeenCalled(); expect(h.db.commercialOffering.upsert).toHaveBeenCalled();
  });
});
