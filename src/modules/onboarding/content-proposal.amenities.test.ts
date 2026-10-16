import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { parseContentProposal, contentAmenityText, type ContentAmenity, type ContentAmenitySnapshot, type ContentProposal } from './content-proposal.schema';
import { contentProposalFailure } from './content-proposal.service';
import { harness } from './content-proposal.service.test-support';

const amenity = (id: string | null = 'pool'): ContentAmenity => ({
  id, locale: 'en', name: 'Pool', shortDescription: 'Swimming pool', description: 'A shared swimming pool.',
  locationLabel: 'Building A, floor 2', accessInstructions: 'Ask reception about access.',
  openingHours: { mode: 'keep' }, rules: { mode: 'keep' },
});
const row = (id = 'pool', projectId = 'project') => ({ ...amenity(id), projectId, slug: id,
  updatedAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2026-01-01T00:00:00Z'),
  openingHours: { monday: [['08:00', '20:00']], seasonal: { summer: 'Ask reception' }, timezone: 'Asia/Bangkok' },
  rules: { visitors: ['No glass'], staffOnly: ['Verify access pass'] }, published: true, isFeatured: true,
  bookingMode: 'time_slot', bookingRequired: true, reservationConfig: { capacity: 6, autoConfirm: false, minLeadMinutes: 1440 },
  pricingType: 'paid', priceThb: 25000, accessType: 'reservation', capacity: 6, minAge: 12,
  bookingUrl: null, coverMediaId: null, categoryKey: 'pool', iconKey: 'waves', terms: 'Existing terms', sort: 3,
});

function projectHarness() {
  const h = harness();
  Object.assign(h.state().roles[0], { scopeType: 'project', unitId: null });
  h.state().amenities.push(row(), row('gym'), row('foreign', 'other-project'));
  const target = () => h.service.target('author', 'project', 'project');
  const payload = async (amenities?: ContentAmenity[]): Promise<ContentProposal<'project'>> => {
    const current = await target();
    return { facts: current.snapshot.facts as ContentProposal<'project'>['facts'], description: null,
      gallery: { mediaIds: [], coverMediaId: null }, ...(amenities ? { amenities } : {}) };
  };
  const create = async (items?: ContentAmenity[], status = 'submitted') => {
    const current = await target();
    return h.service.create('author', { scope: 'project', targetId: 'project', baselineVersion: current.baselineVersion,
      proposal: await payload(items), status });
  };
  return { ...h, target, payload, createProject: create };
}

describe('descriptive amenity proposal boundary', () => {
  let h: ReturnType<typeof projectHarness>;
  beforeEach(() => { h = projectHarness(); });
  it('returns canonical facilities without commercial state or unrelated project facilities', async () => {
    const { snapshot } = await h.target();
    expect(snapshot.amenities?.map(a => a.id)).toEqual(['pool', 'gym']);
    expect(snapshot.amenities?.[0]).not.toHaveProperty('priceThb');
    expect(snapshot.amenities?.[0]).not.toHaveProperty('reservationConfig');
    expect(snapshot.facts).not.toHaveProperty('facilities');
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    const locks = h.db.$queryRaw.mock.calls.map((args: any) => args[0].join('?'));
    expect(locks.some((sql: string) => sql.includes('FROM project_amenity') && sql.includes('ORDER BY id FOR UPDATE'))).toBe(true);
  });
  it('saves separately, then approval changes only descriptive fields and preserves custom schedules, rules and commercial state', async () => {
    const before = structuredClone(h.state().amenities);
    const proposal = { ...amenity(), description: 'Detailed\nvisitor information.', locationLabel: 'Floor 3' };
    const created = await h.createProject([proposal]);
    expect(h.state().amenities).toEqual(before);
    const approved = await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(approved.status).toBe('approved');
    expect(h.state().amenities[0]).toEqual({ ...before[0], description: proposal.description, locationLabel: 'Floor 3', updatedAt: expect.any(Date) });
    expect(h.state().amenities[0].updatedAt.getTime()).toBeGreaterThan(before[0].updatedAt.getTime());
    expect(h.state().amenities.slice(1)).toEqual(before.slice(1));
    const writes = h.db.projectAmenity.update.mock.calls[0][0];
    expect(writes.where).toEqual({ id: 'pool', projectId: 'project' });
    expect(writes.data).toEqual({ description: proposal.description, locationLabel: 'Floor 3', updatedAt: expect.any(Date) });
    expect(h.db.projectAmenity.deleteMany).not.toHaveBeenCalled();
    expect(h.db.unit.update).not.toHaveBeenCalled();
  });
  it('creates only unpublished descriptive facilities with unknown commercial access and idempotent approval', async () => {
    const created = await h.createProject([{ ...amenity(null), openingHours: { mode: 'daily', open: '00:00', close: '24:00', timezone: null }, rules: { mode: 'replace', lines: ['No glass'] } }]);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    const added = h.state().amenities[3];
    expect(added).toMatchObject({ projectId: 'project', published: false, isFeatured: false, accessType: 'not_specified',
      pricingType: 'not_specified', priceThb: null, bookingRequired: false, bookingMode: 'none', bookingUrl: null,
      capacity: null, minAge: null, openingHours: { daily: [['00:00', '24:00']] }, rules: ['No glass'] });
    expect(added).not.toHaveProperty('reservationConfig');
    expect(added.id).toMatch(/^[a-f0-9-]{36}$/);
    expect((await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).alreadyApproved).toBe(true);
    expect(h.state().amenities).toHaveLength(4); expect(h.db.projectAmenity.create).toHaveBeenCalledTimes(1);
    expect(h.state().audit).toHaveLength(1);
  });
  it.each([undefined, []])('omitting facilities or using an empty list never removes or replaces them (%j)', async items => {
    const before = structuredClone(h.state().amenities);
    const created = await h.createProject(items);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities).toEqual(before); expect(h.db.projectAmenity.update).not.toHaveBeenCalled();
  });
  it('rejects foreign and deleted facility IDs before saving', async () => {
    await expect(h.createProject([amenity('foreign')])).rejects.toMatchObject({ status: 403 });
    await expect(h.createProject([amenity('missing')])).rejects.toMatchObject({ status: 403 });
    expect(h.state().rows).toHaveLength(0);
  });
  it.each(['added', 'deleted', 'descriptive', 'commercial', 'schedule', 'revision'])('rejects a stale facility baseline after %s changes', async change => {
    const created = await h.createProject([amenity()]);
    if (change === 'added') h.state().amenities.push(row('new'));
    if (change === 'deleted') h.state().amenities.splice(1, 1);
    if (change === 'descriptive') h.state().amenities[1].name = 'Changed gym';
    if (change === 'commercial') h.state().amenities[0].priceThb = 99999;
    if (change === 'schedule') h.state().amenities[0].openingHours.timezone = 'UTC';
    if (change === 'revision') h.state().amenities[0].updatedAt = new Date('2026-02-01');
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(h.db.projectAmenity.update).not.toHaveBeenCalled();
  });
  it('changes daily times without dropping staff hours or custom schedule keys, and only explicitly clears hours', async () => {
    const original = structuredClone(h.state().amenities[0].openingHours);
    const created = await h.createProject([{ ...amenity(), openingHours: { mode: 'daily', open: '21:00', close: '02:00', timezone: null }, rules: { mode: 'replace', lines: ['No food', 'No glass'] } }]);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    const { timezone: _timezone, ...preserved } = original;
    expect(h.state().amenities[0].openingHours).toEqual({ ...preserved, daily: [['21:00', '02:00']] });
    const second = await h.createProject([{ ...amenity(), openingHours: { mode: 'clear' } }]);
    await h.service.review('admin', second.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].openingHours).toBeNull();
    expect(h.db.projectAmenity.update.mock.lastCall?.[0].data.openingHours).toBe(Prisma.JsonNull);
    expect(h.state().amenities[0].rules).toEqual(['No food', 'No glass']);
  });
  it('retries only rolled-back serialization conflicts and keeps approval idempotent', async () => {
    const created = await h.createProject([amenity(null)]);
    h.db.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockRejectedValueOnce({ code: 'P2010', meta: { code: '40001' } });
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities).toHaveLength(4);
    h.db.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    expect((await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).alreadyApproved).toBe(true);
    expect(h.db.projectAmenity.create).toHaveBeenCalledTimes(1);
    expect(h.state().audit).toHaveLength(1);
    h.db.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockRejectedValueOnce({ code: 'P2034' }).mockRejectedValueOnce({ code: 'P2034' });
    await expect(h.target()).rejects.toMatchObject({ status: 409 });
    h.db.$transaction.mockRejectedValueOnce({ code: 'P2028' });
    await expect(h.target()).rejects.toMatchObject({ code: 'P2028' });
  });
  it.each(['descriptionKey', 'marketingTitleKey', 'cancellationPolicyKey'])('rejects an unrelated unit %s alias to a scoped facility key', async field => {
    h.state().units[0][field] = 'project_amenity.pool.name';
    const created = await h.createProject([{ ...amenity(), name: 'Changed pool' }]);
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(h.db.projectAmenity.update).not.toHaveBeenCalled(); expect(h.state().translations).toHaveLength(2);
  });
  it('rejects project handbook aliases but permits descriptive non-text edits', async () => {
    h.state().projects[0].handbookKey = 'project_amenity.pool.name';
    const safe = await h.createProject([{ ...amenity(), locationLabel: 'Floor 5' }]);
    await h.service.review('admin', safe.id, { action: 'approve', expectedRevision: 1 });
    const unsafe = await h.createProject([{ ...amenity(), name: 'Changed pool' }]);
    await expect(h.service.review('admin', unsafe.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it('keeps whitespace-only differences in prefilled fallback content from becoming authored changes', async () => {
    h.state().keys.push({ id: 'pool-name', key: 'project_amenity.pool.name', namespace: 'project_amenity', supportsRich: false });
    h.state().translations.push({ id: 'pool-ru', contentKeyId: 'pool-name', locale: 'ru', value: '  Бассейн\n', status: 'needs_review' });
    const created = await h.createProject([{ ...amenity(), name: '  Бассейн\n', locationLabel: 'Floor 9' }]);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].name).toBe('Pool');
    expect(h.state().translations.some((t: any) => t.contentKeyId === 'pool-name' && t.locale === 'en')).toBe(false);
  });
  it.each(['Every weekday 09–17', [['08:00', '20:00']]])('keeps legacy custom schedule %j and rejects unpreservable daily edits', async schedule => {
    h.state().amenities[0].openingHours = schedule;
    const safe = await h.createProject([{ ...amenity(), locationLabel: 'Floor 7' }]);
    await h.service.review('admin', safe.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].openingHours).toEqual(schedule);
    await expect(h.createProject([{ ...amenity(), openingHours: { mode: 'daily', open: '08:00', close: '20:00', timezone: null } }])).rejects.toMatchObject({ status: 409 });
    expect(h.state().amenities[0].openingHours).toEqual(schedule);
  });
  it('edits staff contact hours separately, preserves split custom access schedules, and retains timezone after clearing access', async () => {
    h.state().amenities[0].openingHours = { monday: [['08:00', '12:00'], ['14:00', '20:00']], daily: [['00:00', '24:00']], timezone: 'Asia/Bangkok' };
    h.state().amenities[0].updatedAt = new Date('2070-01-01');
    const original = structuredClone(h.state().amenities[0]);
    const first = await h.createProject([{ ...amenity(), staffHours: { mode: 'range', open: '09:00', close: '18:00' } }]);
    await h.service.review('admin', first.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].updatedAt.getTime()).toBe(original.updatedAt.getTime() + 1);
    expect(h.state().amenities[0].openingHours).toEqual({ ...original.openingHours, staffContact: [['09:00', '18:00']] });
    const second = await h.createProject([{ ...amenity(), openingHours: { mode: 'clear' } }]);
    await h.service.review('admin', second.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].openingHours).toEqual({ staffContact: [['09:00', '18:00']], timezone: 'Asia/Bangkok' });
    const third = await h.createProject([{ ...amenity(), staffHours: { mode: 'clear' } }]);
    await h.service.review('admin', third.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].openingHours).toBeNull();
    expect(h.db.projectAmenity.update.mock.lastCall?.[0].data.openingHours).toBe(Prisma.JsonNull);
  });
  it('supports explicit staff-only timezone without inventing daily access hours', async () => {
    h.state().amenities[0].openingHours = null;
    const created = await h.createProject([{ ...amenity(), staffHours: { mode: 'range', open: '09:00', close: '24:00', timezone: 'Asia/Bangkok' } }]);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities[0].openingHours).toEqual({ staffContact: [['09:00', '24:00']], timezone: 'Asia/Bangkok' });
    await expect(h.createProject([{ ...amenity(), openingHours: { mode: 'daily', open: '00:00', close: '24:00', timezone: 'UTC' },
      staffHours: { mode: 'range', open: '09:00', close: '18:00', timezone: 'Asia/Bangkok' } }])).rejects.toMatchObject({ status: 409 });
  });
  it('rolls back all canonical updates if a later content-key write fails', async () => {
    const created = await h.createProject([{ ...amenity(), name: 'New name' }]);
    const before = structuredClone(h.state());
    h.db.contentKey.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toEqual({ code: 'P2002' });
    expect(h.state()).toEqual(before); expect(contentProposalFailure({ code: 'P2034' }).status).toBe(409);
  });
  it('rechecks exact-project contributor grant and admin authority at approval', async () => {
    const created = await h.createProject([amenity()]);
    await expect(h.service.review('author', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    h.state().roles[0].scopeType = 'unit'; h.state().roles[0].unitId = 'managed-legendary-d201';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    expect(h.db.projectAmenity.update).not.toHaveBeenCalled();
  });
  it('updates only explicitly changed locale fields and retains empty/unreviewed fallback semantics', async () => {
    h.state().keys.push({ id: 'pool-name', key: 'project_amenity.pool.name', namespace: 'project_amenity', supportsRich: false });
    h.state().translations.push({ id: 'pool-en', contentKeyId: 'pool-name', locale: 'en', value: '', status: 'missing' },
      { id: 'pool-ru', contentKeyId: 'pool-name', locale: 'ru', value: 'Бассейн', status: 'needs_review' });
    const before = (await h.target()).snapshot.amenities![0];
    expect(contentAmenityText(before, 'en', 'name')).toBe('Бассейн');
    const created = await h.createProject([{ ...amenity(), name: 'Бассейн', locationLabel: 'Floor 4' }]);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().translations.find((t: any) => t.id === 'pool-en').value).toBe('');
    expect(h.state().amenities[0].name).toBe('Pool');
    const changed = await h.createProject([{ ...amenity(), name: 'Indoor pool' }]);
    await h.service.review('admin', changed.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().translations.find((t: any) => t.id === 'pool-en')).toMatchObject({ value: 'Indoor pool', status: 'needs_review', updatedByIdentityId: 'admin' });
    expect(h.state().translations.find((t: any) => t.id === 'pool-ru')).toMatchObject({ value: 'Бассейн', status: 'needs_review' });
    expect(h.state().amenities[0].name).toBe('Indoor pool');
    expect(contentAmenityText((await h.target()).snapshot.amenities![0], 'th', 'name')).toBe('Indoor pool');
  });
  it.each(['value', 'status', 'added-locale', 'added-key', 'namespace'])('rejects changed amenity translation baseline (%s)', async change => {
    h.state().keys.push({ id: 'pool-name', key: 'project_amenity.pool.name', namespace: 'project_amenity', supportsRich: false });
    h.state().translations.push({ id: 'pool-en', contentKeyId: 'pool-name', locale: 'en', value: 'Pool', status: 'ok' });
    const created = await h.createProject([amenity()]);
    if (change === 'value') h.state().translations[2].value = 'Changed';
    if (change === 'status') h.state().translations[2].status = 'needs_review';
    if (change === 'added-locale') h.state().translations.push({ id: 'pool-ru', contentKeyId: 'pool-name', locale: 'ru', value: 'Бассейн', status: 'ok' });
    if (change === 'added-key') h.state().keys.push({ id: 'pool-desc', key: 'project_amenity.pool.description', namespace: 'project_amenity', supportsRich: false });
    if (change === 'namespace') h.state().keys[1].namespace = 'other';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it.each([{ namespace: 'other', supportsRich: false }, { namespace: 'project_amenity', supportsRich: true }])('does not clobber incompatible amenity keys (%j)', async attributes => {
    h.state().keys.push({ id: 'pool-name', key: 'project_amenity.pool.name', ...attributes });
    const created = await h.createProject([{ ...amenity(), name: 'Updated' }]);
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(h.state().amenities[0].name).toBe('Pool');
  });
  it('keeps an old v1 project proposal readable and approvable without touching amenities, then explicitly upgrades returned drafts on rebase', async () => {
    const target = await h.target();
    const { amenities: _amenities, ...snapshot } = target.snapshot;
    const stable = (value: any): string => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value !== null && typeof value === 'object'
      ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}` : JSON.stringify(value);
    const legacyFingerprint = createHash('sha256').update(stable(JSON.parse(JSON.stringify({ scope: 'project', id: 'project', projectId: 'project', snapshot,
      updatedAt: h.state().projects[0].updatedAt, content: null, marketingTitleKey: null, pairedTitleKey: null, titleContent: null, gallery: [] })))).digest('hex');
    const proposal = await h.payload();
    h.state().rows.push({ id: 'legacy', identityId: 'author', source: 'myuno_property_content_proposal_v1', projectId: 'project', unitId: null,
      updatedAt: new Date('2026-01-01'), requirements: { version: 1, scope: 'project', targetId: 'project', projectId: 'project', status: 'submitted', revision: 1,
        baselineVersion: legacyFingerprint, baseline: snapshot, proposal, reviewNote: null, approvedFromRevision: null } });
    expect((await h.service.get('author', 'legacy')).baseline).not.toHaveProperty('amenities');
    const before = structuredClone(h.state().amenities);
    await h.service.review('admin', 'legacy', { action: 'approve', expectedRevision: 1 });
    expect(h.state().amenities).toEqual(before);
    h.state().rows[0].requirements.status = 'returned';
    h.state().rows[0].requirements.approvedFromRevision = null;
    await expect(h.service.update('author', 'legacy', { expectedRevision: 2, proposal: { ...proposal, amenities: [] }, status: 'draft' })).rejects.toMatchObject({ status: 409 });
    const upgraded = await h.service.update('author', 'legacy', { expectedRevision: 2, action: 'rebase' });
    expect(upgraded.baseline.amenities).toHaveLength(2); expect(h.state().rows[0].requirements.version).toBe(2);
  });
});

describe('amenity schema allowlist', () => {
  const parse = async (value: unknown) => parseContentProposal('project', { ...(await projectHarness().payload()), amenities: value });
  it.each(['priceThb', 'pricingType', 'bookingMode', 'bookingRequired', 'bookingUrl', 'reservationConfig', 'capacity', 'autoConfirm', 'published', 'sort', 'projectId', 'slug', 'coverMediaId'])('rejects %s', async field => {
    await expect(parse([{ ...amenity(), [field]: 'forbidden' }])).rejects.toThrow('Invalid content proposal');
  });
  it('rejects unit-scoped facilities and duplicate IDs but accepts multiple new drafts', async () => {
    const h = harness();
    expect(() => parseContentProposal('unit', { ...h.payload(), amenities: [] })).toThrow('Invalid content proposal');
    await expect(parse([amenity(), amenity()])).rejects.toThrow('Invalid content proposal');
    expect((await parse([amenity(null), amenity(null)])).amenities).toHaveLength(2);
  });
  it.each([{ mode: 'daily', open: '24:00', close: '08:00', timezone: null }, { mode: 'daily', open: '08:00', close: '08:00', timezone: null },
    { mode: 'daily', open: '08:00', close: '20:00', timezone: 'Not/AZone' }, { mode: 'keep', timezone: 'UTC' }, { mode: 'custom', json: {} }])('rejects malformed hours %j', async openingHours => {
    await expect(parse([{ ...amenity(), openingHours }])).rejects.toThrow('Invalid content proposal');
  });
  it.each([{ mode: 'range', open: '09:00', close: '09:00' }, { mode: 'range', open: '24:00', close: '08:00' },
    { mode: 'range', open: '09:00', close: '18:00', timezone: 'Invalid/Zone' }, { mode: 'keep', timezone: 'UTC' },
    { mode: 'range', open: '09:00', close: '18:00', capacity: 10 }, { mode: 'clear', open: '09:00' }])('rejects malformed staff hours %j', async staffHours => {
    await expect(parse([{ ...amenity(), staffHours }])).rejects.toThrow('Invalid content proposal');
  });
  it('rejects staff-hours getters without exposing their error content', async () => {
    const staffHours = Object.defineProperty({ mode: 'range', close: '18:00' }, 'open', { enumerable: true, get: () => { throw new Error('SECRET'); } });
    await expect(parse([{ ...amenity(), staffHours }])).rejects.toThrow('Invalid content proposal');
  });
  it('rejects excess draft/rule bounds, getters, hidden keys and invalid locales', async () => {
    await expect(parse(Array.from({ length: 101 }, () => amenity(null)))).rejects.toThrow('Invalid content proposal');
    await expect(parse([{ ...amenity(), rules: { mode: 'replace', lines: Array(51).fill('rule') } }])).rejects.toThrow('Invalid content proposal');
    await expect(parse([{ ...amenity(), locale: 'fr' }])).rejects.toThrow('Invalid content proposal');
    const hidden = amenity(); Object.defineProperty(hidden, 'priceThb', { value: 1 });
    await expect(parse([hidden])).rejects.toThrow('Invalid content proposal');
    const getter = amenity(); Object.defineProperty(getter, 'name', { enumerable: true, get: () => { throw new Error('SECRET'); } });
    await expect(parse([getter])).rejects.toThrow('Invalid content proposal');
  });
  it('does not infer facts or translation approval from missing data', async () => {
    const result = await parse([{ ...amenity(null), locationLabel: null, shortDescription: null, description: null, accessInstructions: null }]);
    expect(result.amenities![0]).toMatchObject({ locationLabel: null, openingHours: { mode: 'keep' }, rules: { mode: 'keep' } });
  });
  it('uses the same requested-locale fallback chain for empty and draft content', () => {
    const snapshot: ContentAmenitySnapshot = { ...row(), translations: { en: { name: '' }, ru: { name: 'Бассейн' }, th: { name: 'สระว่ายน้ำ' } } };
    expect(contentAmenityText(snapshot, 'en', 'name')).toBe('Бассейн');
    expect(contentAmenityText(snapshot, 'th', 'name')).toBe('สระว่ายน้ำ');
  });
});
