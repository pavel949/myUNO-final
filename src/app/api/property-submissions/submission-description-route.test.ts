import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Execute the real intake and conversion handlers with a bounded, in-memory
// Prisma double. No database, credentials, invites or production writes.
const h = vi.hoisted(() => ({
  user: { identityId: 'employee', isAdmin: false, roles: [] as unknown[] } as { identityId: string; isAdmin: boolean; roles: unknown[] } | null,
  rows: new Map<string, any>(),
  sequence: 0,
  db: {} as any,
  resolveUnit: vi.fn(),
  owner: vi.fn(),
  engagement: vi.fn(),
  offerings: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: h.db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => h.user }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAdmin: async () => h.user?.isAdmin
  ? { ok: true, actorIdentityId: h.user.identityId }
  : { ok: false, error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) } }));
vi.mock('@/modules/projects', () => ({ setUnitOwnerTx: h.owner }));
vi.mock('@/modules/core', () => ({ createDraftUnitEngagementTx: h.engagement }));
vi.mock('@/modules/onboarding', () => ({
  classifyPropertySubmission: () => 'rental',
  resolveCanonicalUnitTx: h.resolveUnit,
  ensureDraftCommercialOfferingsTx: h.offerings,
  deriveUnitOnboardingState: async () => ({ state: 'draft', blockers: [] }),
}));
vi.mock('@/modules/onboarding/submission-unit-access', () => ({ submissionUnitWhere: (_user: unknown, projectId: string) => ({ projectId }) }));

import { POST as intake, PATCH as amend } from './route';
import { POST as convert } from '@/app/api/admin/property-submissions/[id]/convert/route';

const request = (body: object, method = 'POST') => new NextRequest('http://localhost/api/property-submissions', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const reviewed = { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false };
const input = (extra: object = {}) => ({ kind: 'home', projectId: 'project', unitName: 'A201', bedrooms: 1, bathrooms: 1, maxGuests: 2,
  description: '  Квартира с отдельной спальней.  ', descriptionLocale: 'ru', offers: ['monthly'], photos: [], status: 'submitted', ...extra });
async function submit(extra: object = {}) {
  const response = await intake(request(input(extra)));
  expect(response.status).toBe(201);
  return response.json();
}
async function approve(id: string, review: object = reviewed) {
  h.user = { identityId: 'reviewer', isAdmin: true, roles: [] };
  return convert(request(review), { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks(); h.rows.clear(); h.sequence = 0;
  h.user = { identityId: 'employee', isAdmin: false, roles: [] };
  h.resolveUnit.mockResolvedValue({ unitId: null, duplicateCandidateId: null });
  Object.assign(h.db, {
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (work: (tx: any) => unknown) => work(h.db)),
    crmOpportunity: {
      create: vi.fn(async ({ data }: any) => { const row = { id: `00000000-0000-0000-0000-${String(++h.sequence).padStart(12, '0')}`, ...data }; h.rows.set(row.id, row); return row; }),
      findUnique: vi.fn(async ({ where }: any) => h.rows.get(where.id) ?? null),
      findFirst: vi.fn(async ({ where }: any) => { const row = h.rows.get(where.id); return row?.identityId === where.identityId ? row : null; }),
      update: vi.fn(async ({ where, data }: any) => { const row = { ...h.rows.get(where.id), ...data }; h.rows.set(row.id, row); return row; }),
    },
    identity: { findUnique: vi.fn(async () => ({ id: 'employee' })) },
    project: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, status: 'live' })), findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'new-project' })), update: vi.fn() },
    unit: { create: vi.fn(async ({ data }: any) => ({ id: 'new-unit', ...data })), findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => ({ coverMediaId: null })), update: vi.fn() },
    area: { findUnique: vi.fn(async () => ({ id: 'area', status: 'live' })) },
    contentKey: { create: vi.fn(async ({ data }: any) => ({ id: 'content-key', ...data })) },
    auditLog: { create: vi.fn(async () => ({})) },
  });
});

describe('submitted description reaches the new canonical record', () => {
  it.each([
    ['ru', 'Квартира с отдельной спальней.'], ['en', 'A home with a separate bedroom.'],
    ['th', 'ที่พักมีห้องนอนแยก'], ['zh', '设有独立卧室的住所。'],
  ])('preserves %s through ordinary-account intake and admin conversion', async (locale, description) => {
    const application = await submit({ description, descriptionLocale: locale });
    expect(application.requirements).toMatchObject({ description, descriptionLocale: locale });
    expect(h.db.unit.create).not.toHaveBeenCalled();
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
    const response = await approve(application.id);
    expect(response.status).toBe(200);
    const key = `unit.${application.id.replace(/-/g, '')}.description`;
    expect(h.db.unit.create.mock.calls[0][0].data).toMatchObject({ descriptionKey: key, status: 'draft' });
    expect(h.db.contentKey.create).toHaveBeenCalledTimes(1);
    expect(h.db.contentKey.create).toHaveBeenCalledWith({ data: {
      key, namespace: 'unit', description: 'Property description preserved from reviewed onboarding submission', supportsRich: false,
      translations: { create: { locale, value: description, status: 'needs_review', updatedByIdentityId: 'reviewer' } },
    } });
    expect(h.owner).not.toHaveBeenCalled();
    expect(h.engagement).not.toHaveBeenCalled();
    expect(h.rows.get(application.id).requirements).toMatchObject({ status: 'converted', descriptionLocale: locale });
  });

  it('preserves description and locale across draft save and submit', async () => {
    const created = await submit({ status: 'draft', descriptionLocale: 'th', description: 'ที่พักมีห้องนอนแยก' });
    const saved = await amend(request({ id: created.id, floor: '2' }, 'PATCH'));
    expect(saved.status).toBe(200);
    const sent = await amend(request({ id: created.id, status: 'submitted' }, 'PATCH'));
    expect(sent.status).toBe(200);
    expect((await sent.json()).requirements).toMatchObject({ descriptionLocale: 'th', description: 'ที่พักมีห้องนอนแยก' });
    expect((await approve(created.id)).status).toBe(200);
    expect(h.db.contentKey.create.mock.calls[0][0].data.translations.create.locale).toBe('th');
  });

  it('does not let the applicant convert their own submission', async () => {
    const application = await submit();
    expect((await convert(request(reviewed), { params: { id: application.id } })).status).toBe(403);
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
    expect(h.db.unit.create).not.toHaveBeenCalled();
  });

  it('requires an explicit reviewer locale for a legacy submission rather than guessing', async () => {
    const application = await submit({ descriptionLocale: null });
    expect((await approve(application.id)).status).toBe(400);
    expect(h.db.unit.create).not.toHaveBeenCalled();
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
    expect((await approve(application.id, { ...reviewed, descriptionLocale: 'ru' })).status).toBe(200);
    expect(h.db.contentKey.create.mock.calls[0][0].data.translations.create.locale).toBe('ru');
  });

  it('does not relabel the applicant language with the reviewer language', async () => {
    const application = await submit();
    expect((await approve(application.id, { ...reviewed, descriptionLocale: 'en' })).status).toBe(200);
    expect(h.db.contentKey.create.mock.calls[0][0].data.translations.create.locale).toBe('ru');
  });

  it('rejects unsupported locale metadata before saving the intake', async () => {
    expect((await intake(request(input({ descriptionLocale: 'xx' })))).status).toBe(400);
    expect(h.db.crmOpportunity.create).not.toHaveBeenCalled();
  });

  it('does not create blank content or force a language on an empty description', async () => {
    const application = await submit({ description: '  ', descriptionLocale: null });
    expect((await approve(application.id)).status).toBe(200);
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
  });

  it('creates project content only for a new complex-only submission', async () => {
    const application = await submit({ kind: 'resort', projectId: null, proposedProject: 'New Bay', projectAddress: 'Bay Road', areaId: 'area', latitude: 7, longitude: 98, unitName: '', offers: [] });
    expect((await approve(application.id)).status).toBe(200);
    const key = h.db.project.create.mock.calls[0][0].data.descriptionKey;
    expect(h.db.contentKey.create.mock.calls[0][0].data).toMatchObject({ key, namespace: 'project' });
    expect(h.db.unit.create).not.toHaveBeenCalled();
  });

  it('keeps home prose out of the shared project description', async () => {
    const application = await submit({ projectId: null, proposedProject: 'New Bay', projectAddress: 'Bay Road', areaId: 'area', latitude: 7, longitude: 98 });
    expect((await approve(application.id)).status).toBe(200);
    expect(h.db.contentKey.create).toHaveBeenCalledTimes(1);
    expect(h.db.contentKey.create.mock.calls[0][0].data.namespace).toBe('unit');
  });

  it('does not overwrite an existing unit description', async () => {
    h.db.unit.findFirst.mockResolvedValue({ id: 'existing-unit' });
    const application = await submit({ existingUnitId: 'existing-unit' });
    h.resolveUnit.mockResolvedValue({ unitId: 'existing-unit', duplicateCandidateId: null });
    expect((await approve(application.id)).status).toBe(200);
    expect(h.db.unit.create).not.toHaveBeenCalled();
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing shared-project description for a complex-only match', async () => {
    const application = await submit({ kind: 'resort', unitName: '', offers: [] });
    expect((await approve(application.id)).status).toBe(200);
    expect(h.db.project.create).not.toHaveBeenCalled();
    expect(h.db.unit.create).not.toHaveBeenCalled();
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
  });

  it('returns the same canonical result on retry without duplicating content', async () => {
    const application = await submit();
    expect((await approve(application.id)).status).toBe(200);
    const retry = await approve(application.id);
    expect(await retry.json()).toMatchObject({ unitId: 'new-unit', alreadyConverted: true });
    expect(h.db.contentKey.create).toHaveBeenCalledTimes(1);
    expect(h.db.unit.create).toHaveBeenCalledTimes(1);
  });
});
