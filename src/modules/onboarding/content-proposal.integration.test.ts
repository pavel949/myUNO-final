/**
 * Real PostgreSQL/Prisma coverage. Run only with the repository's isolated
 * DATABASE_URL_TEST and applied TEST migrations, including content_contributor.
 * This file never reads production configuration or creates/applies migrations.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient, Prisma } from '@prisma/client';
import { createContentProposalService, CONTENT_PROPOSAL_SOURCE } from './content-proposal.service';

let db: PrismaClient;
let fixtures: typeof import('@/test/util');
let service: ReturnType<typeof createContentProposalService>;
describe('content proposal PostgreSQL transactions and concurrent writers', () => {
  let author: string, reviewer: string, projectId: string, unitId: string;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://missing');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname) ||
        !/(?:^|[_-])test(?:[_-]|$)/i.test(url.pathname.slice(1))) {
      throw new Error('Content proposal integration tests require a local dedicated test database');
    }
    fixtures = await import('@/test/util');
    db = fixtures.db; service = createContentProposalService(db);
  });
  beforeEach(async () => {
    await fixtures.resetDb();
    author = (await fixtures.createIdentity()).id;
    reviewer = (await fixtures.createIdentity({ isAdmin: true })).id;
    projectId = (await fixtures.createProject()).id;
    unitId = (await fixtures.createUnit({ projectId })).id;
    await db.roleAssignment.create({ data: { identityId: author, role: 'content_contributor', scopeType: 'unit', projectId, unitId } });
  });
  const draft = async (status: 'draft' | 'submitted' = 'submitted') => {
    const current = await service.target(author, 'unit', unitId);
    return service.create(author, { scope: 'unit', targetId: unitId, status, baselineVersion: current.baselineVersion,
      proposal: { facts: { ...current.snapshot.facts, name: 'Reviewed unit' }, description: null,
        gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } } });
  };
  it('serializes distinct proposals from the same baseline: exactly one approval and audit', async () => {
    const first = await draft(), second = await draft();
    expect(first.baselineVersion).toBe(second.baselineVersion);
    const outcomes = await Promise.allSettled([
      service.review(reviewer, first.id, { action: 'approve', expectedRevision: 1 }),
      service.review(reviewer, second.id, { action: 'approve', expectedRevision: 1 }),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    const rejection = outcomes.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejection.reason).toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { action: 'property_content_proposal.approved' } })).toBe(1);
    const rows = await db.crmOpportunity.findMany({ where: { source: CONTENT_PROPOSAL_SOURCE }, select: { requirements: true } });
    expect(rows.map(row => (row.requirements as Record<string, unknown>).status).sort()).toEqual(['approved', 'submitted']);
  });
  it('serializes duplicate approval clicks and emits only one audit event', async () => {
    const proposal = await draft();
    const outcomes = await Promise.all([
      service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 }),
      service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 }),
    ]);
    expect(outcomes.every(result => result.status === 'approved')).toBe(true);
    expect(outcomes.filter(result => 'alreadyApproved' in result && result.alreadyApproved)).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: proposal.id, action: 'property_content_proposal.approved' } })).toBe(1);
  });
  it.each(['insert', 'delete', 'reorder'] as const)('holds canonical/gallery locks against a concurrent gallery %s', async action => {
    const attached = await db.mediaAsset.create({ data: { storageKey: `https://example.com/${unitId}-attached.jpg`, kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 42, uploadedByIdentityId: author } });
    const added = await db.mediaAsset.create({ data: { storageKey: `https://example.com/${unitId}-added.jpg`, kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 42, uploadedByIdentityId: author } });
    await db.unitMedia.create({ data: { unitId, mediaId: attached.id, sort: 0 } });
    const proposal = await draft();
    let signalLocked!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { signalLocked = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    let paused = false;
    // Pause the real service transaction only AFTER its real PostgreSQL parent
    // and linked-row locks are held. No fake mutex substitutes for DB locking.
    const pausingDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
        target.$transaction(async tx => run(new Proxy(tx, { get(inner, name) {
          if (name === '$queryRaw') return async (parts: TemplateStringsArray, ...values: unknown[]) => {
            const result = await inner.$queryRaw(parts, ...values);
            if (!paused && parts.join('?').includes('FROM unit_media') && parts.join('?').includes('FOR UPDATE')) {
              paused = true; signalLocked(); await released;
            }
            return result;
          };
          return Reflect.get(inner, name);
        } })), options);
      return Reflect.get(target, property);
    } });
    const approval = createContentProposalService(pausingDb).review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    await Promise.race([locked, approval.then(() => { throw new Error('Approval unexpectedly completed before the lock checkpoint'); })]);
    let signalWriter!: (pid: number) => void;
    const writerPid = new Promise<number>(resolve => { signalWriter = resolve; });
    const writer = db.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      signalWriter(row.pid);
      if (action === 'insert') return tx.unitMedia.create({ data: { unitId, mediaId: added.id, sort: 1 } });
      if (action === 'delete') return tx.unitMedia.delete({ where: { unitId_mediaId: { unitId, mediaId: attached.id } } });
      return tx.unitMedia.update({ where: { unitId_mediaId: { unitId, mediaId: attached.id } }, data: { sort: 9 } });
    });
    const outcomes = Promise.allSettled([approval, writer]);
    let observedLock = false;
    try {
      const pid = await writerPid;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<{ wait_event_type: string | null }[]>`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
        if (rows[0]?.wait_event_type === 'Lock') { observedLock = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { release(); await outcomes; }
    expect(observedLock).toBe(true);
    expect((await approval).status).toBe('approved');
    await writer;
  });
  it('rejects a stale gallery reorder even when the parent timestamp was not updated', async () => {
    const asset = await db.mediaAsset.create({ data: { storageKey: `https://example.com/${unitId}.jpg`, kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 42, uploadedByIdentityId: author } });
    await db.unitMedia.create({ data: { unitId, mediaId: asset.id, sort: 0 } });
    const proposal = await draft();
    await db.unitMedia.update({ where: { unitId_mediaId: { unitId, mediaId: asset.id } }, data: { sort: 7 } });
    await expect(service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it('rejects a revoked role and a blocked identity before canonical apply', async () => {
    const proposal = await draft();
    await db.roleAssignment.updateMany({ where: { identityId: author }, data: { status: 'revoked' } });
    await expect(service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    await db.roleAssignment.updateMany({ where: { identityId: author }, data: { status: 'active' } });
    await db.identity.update({ where: { id: author }, data: { status: 'blocked' } });
    await expect(service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    expect(await db.auditLog.count({ where: { entityId: proposal.id } })).toBe(0);
  });
  it('rolls back the earlier translation mutation if canonical unit apply fails a real unique constraint', async () => {
    const key = await db.contentKey.create({ data: { key: `unit.${unitId}.description`, namespace: 'unit', description: 'Fixture', supportsRich: false,
      translations: { create: { locale: 'en', value: 'Original', status: 'ok', updatedByIdentityId: author } } } });
    await db.unit.update({ where: { id: unitId }, data: { descriptionKey: key.key } });
    const sibling = await fixtures.createUnit({ projectId, name: 'Already exists' });
    const current = await service.target(author, 'unit', unitId);
    const proposal = await service.create(author, { scope: 'unit', targetId: unitId, status: 'submitted', baselineVersion: current.baselineVersion,
      proposal: { facts: { ...current.snapshot.facts, name: sibling.name }, description: { locale: 'en', value: 'Must roll back' },
        gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } } });
    await expect(service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ code: 'P2002' });
    expect((await db.translation.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale: 'en' } } })).value).toBe('Original');
    expect((await db.crmOpportunity.findUniqueOrThrow({ where: { id: proposal.id } })).requirements).toMatchObject({ status: 'submitted', revision: 1 });
    expect(await db.auditLog.count({ where: { entityId: proposal.id } })).toBe(0);
  });
  it('applies a Decimal gross area and preserves localized paired marketing titles atomically', async () => {
    const oldDescription = await db.contentKey.create({ data: { key: `unit.${unitId}.description`, namespace: 'unit', description: 'Description',
      translations: { create: { locale: 'en', value: 'Original description', status: 'ok', updatedByIdentityId: author } } } });
    const oldTitle = await db.contentKey.create({ data: { key: `unit.${unitId}.title`, namespace: 'unit', description: 'Marketing title',
      translations: { create: [{ locale: 'en', value: 'Sunny corner apartment', status: 'ok', updatedByIdentityId: author },
        { locale: 'th', value: 'Thai marketing title', status: 'needs_review', updatedByIdentityId: author }] } } });
    const originals = await db.translation.findMany({ where: { contentKeyId: oldTitle.id }, orderBy: { locale: 'asc' } });
    await db.unit.update({ where: { id: unitId }, data: { descriptionKey: oldDescription.key, grossAreaSqm: 41.25, sizeSqm: 40 } });
    const current = await service.target(author, 'unit', unitId);
    expect(current.snapshot.facts).toMatchObject({ grossAreaSqm: 41.25, sizeSqm: 40 });
    const proposal = await service.create(author, { scope: 'unit', targetId: unitId, status: 'submitted', baselineVersion: current.baselineVersion,
      proposal: { facts: { ...current.snapshot.facts, grossAreaSqm: 48.75 }, description: { locale: 'en', value: 'Reviewed description' },
        gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } } });
    await service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
    expect(Number(unit.grossAreaSqm)).toBe(48.75); expect(unit.sizeSqm).toBe(40);
    expect(unit.marketingTitleKey).toBe(oldTitle.key);
    const title = await db.contentKey.findUniqueOrThrow({ where: { key: unit.marketingTitleKey! }, include: { translations: { orderBy: { locale: 'asc' } } } });
    expect(title.id).toBe(oldTitle.id);
    for (const [index, previous] of originals.entries()) expect(title.translations[index]).toMatchObject({
      locale: previous.locale, value: previous.value, status: previous.status, updatedByIdentityId: previous.updatedByIdentityId,
      createdAt: previous.createdAt, updatedAt: previous.updatedAt,
    });
    expect(await db.translation.findMany({ where: { contentKeyId: oldTitle.id }, orderBy: { locale: 'asc' } })).toEqual(originals);
  });
  it.each(['missing-title insert', 'existing-title edit'] as const)('keeps the original title pointer reachable through concurrent %s', async action => {
    const descriptionName = `unit.${unitId}.description`, titleName = `unit.${unitId}.title`;
    await db.contentKey.create({ data: { key: descriptionName, namespace: 'unit', description: 'Description fixture' } });
    await db.unit.update({ where: { id: unitId }, data: { descriptionKey: descriptionName } });
    let oldTitleId: string | null = null;
    if (action === 'existing-title edit') {
      oldTitleId = (await db.contentKey.create({ data: { key: titleName, namespace: 'unit', description: 'Title fixture',
        translations: { create: { locale: 'en', value: 'Before edit', status: 'ok', updatedByIdentityId: author } } } })).id;
    }
    const current = await service.target(author, 'unit', unitId);
    const proposal = await service.create(author, { scope: 'unit', targetId: unitId, status: 'submitted', baselineVersion: current.baselineVersion,
      proposal: { facts: current.snapshot.facts, description: { locale: 'en', value: 'Reviewed description' },
        gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } } });
    let signalRead!: () => void, release!: () => void;
    const read = new Promise<void>(resolve => { signalRead = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    // Pause after canonical() has read and hashed the title (or its absence),
    // at the first new-description create. All actual row locks remain held.
    const pausingDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
        target.$transaction(async tx => run(new Proxy(tx, { get(inner, name) {
          if (name === 'contentKey') return new Proxy(inner.contentKey, { get(delegate, method) {
            if (method === 'create') return async (args: Prisma.ContentKeyCreateArgs) => {
              signalRead(); await released; return delegate.create(args);
            };
            return Reflect.get(delegate, method);
          } });
          return Reflect.get(inner, name);
        } })), options);
      return Reflect.get(target, property);
    } });
    const approval = createContentProposalService(pausingDb).review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    await Promise.race([read, approval.then(() => { throw new Error('Approval bypassed title checkpoint'); })]);
    let signalWriter!: (pid: number) => void;
    const writerPid = new Promise<number>(resolve => { signalWriter = resolve; });
    const writer = db.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      signalWriter(row.pid);
      if (oldTitleId) return tx.translation.update({ where: { contentKeyId_locale: { contentKeyId: oldTitleId, locale: 'en' } }, data: { value: 'Concurrent title', updatedByIdentityId: reviewer } });
      return tx.contentKey.create({ data: { key: titleName, namespace: 'unit', description: 'Concurrent title insert',
        translations: { create: { locale: 'en', value: 'Concurrent title', status: 'ok', updatedByIdentityId: reviewer } } } });
    });
    const outcomes = Promise.allSettled([approval, writer]);
    let observedLock = false;
    try {
      const pid = await writerPid;
      if (oldTitleId) {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const rows = await db.$queryRaw<{ wait_event_type: string | null }[]>`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
          if (rows[0]?.wait_event_type === 'Lock') { observedLock = true; break; }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } else {
        // Missing rows cannot be locked. Prove insertion completes while
        // approval is paused, then ensure the pinned name still resolves it.
        await writer;
      }
    } finally { release(); await outcomes; }
    expect((await approval).status).toBe('approved'); await writer;
    if (oldTitleId) expect(observedLock).toBe(true);
    const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
    expect(unit.marketingTitleKey).toBe(titleName); expect(unit.descriptionKey).not.toBe(descriptionName);
    const title = await db.contentKey.findUniqueOrThrow({ where: { key: unit.marketingTitleKey! }, include: { translations: true } });
    expect(title.translations.find(row => row.locale === 'en')?.value).toBe('Concurrent title');
    expect(await db.contentKey.count({ where: { key: unit.descriptionKey!.replace(/\.description$/, '.title') } })).toBe(0);
  });
  it('returns and rebases a stale proposal, requiring an explicit new submission', async () => {
    const proposal = await draft();
    await service.review(reviewer, proposal.id, { action: 'return', expectedRevision: 1, note: 'Verify updated bedroom count.' });
    await db.unit.update({ where: { id: unitId }, data: { bedrooms: 3 } });
    const rebased = await service.update(author, proposal.id, { expectedRevision: 2, action: 'rebase' });
    expect(rebased.status).toBe('draft'); expect(rebased.proposal.facts).toMatchObject({ bedrooms: 3 });
    expect(rebased.proposal.description).toBeNull();
    await service.update(author, proposal.id, { expectedRevision: 3, proposal: rebased.proposal, status: 'submitted' });
    expect((await service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 4 })).status).toBe('approved');
  });
  const facility = (id: string | null) => ({ id, locale: 'en', name: 'Pool', shortDescription: null,
    description: 'Reviewed visitor information.', locationLabel: 'Floor 2', accessInstructions: 'Ask reception.',
    openingHours: { mode: 'keep' }, rules: { mode: 'keep' } });
  async function facilityDraft(id: string | null) {
    await db.roleAssignment.create({ data: { identityId: author, role: 'content_contributor', scopeType: 'project', projectId } });
    const current = await service.target(author, 'project', projectId);
    return service.create(author, { scope: 'project', targetId: projectId, status: 'submitted', baselineVersion: current.baselineVersion,
      proposal: { facts: current.snapshot.facts, description: null, gallery: { mediaIds: [], coverMediaId: null }, amenities: [facility(id)] } });
  }
  it('creates a descriptive draft facility exactly once under concurrent approval without enabling publication or native booking', async () => {
    const proposal = await facilityDraft(null);
    const results = await Promise.all([
      service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 }),
      service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 }),
    ]);
    expect(results.every(result => result.status === 'approved')).toBe(true);
    const rows = await db.projectAmenity.findMany({ where: { projectId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ published: false, accessType: 'not_specified', pricingType: 'not_specified', priceThb: null,
      bookingRequired: false, bookingMode: 'none', bookingUrl: null, reservationConfig: null, capacity: null, minAge: null });
    expect(await db.auditLog.count({ where: { entityId: proposal.id, action: 'property_content_proposal.approved' } })).toBe(1);
    const key = await db.contentKey.findUniqueOrThrow({ where: { key: `project_amenity.${rows[0].id}.description` }, include: { translations: true } });
    expect(key.translations[0]).toMatchObject({ locale: 'en', value: 'Reviewed visitor information.', status: 'needs_review' });
  });
  it('preserves custom facility schedules, other locales and all commercial configuration under a reviewed content edit', async () => {
    const pool = await db.projectAmenity.create({ data: { projectId, slug: 'pool', name: 'Pool', description: 'Old description',
      published: true, bookingRequired: true, bookingMode: 'time_slot', pricingType: 'paid', priceThb: 15000,
      reservationConfig: { capacity: 5, autoConfirm: false }, openingHours: { monday: [['08:00', '20:00']], timezone: 'Asia/Bangkok' }, rules: { visitors: ['No glass'] } } });
    const key = await db.contentKey.create({ data: { key: `project_amenity.${pool.id}.description`, namespace: 'project_amenity', description: 'Fixture',
      translations: { create: [{ locale: 'en', value: 'Old English description', status: 'ok', updatedByIdentityId: author }, { locale: 'th', value: 'Original Thai description', status: 'needs_review', updatedByIdentityId: author }] } } });
    const originalThai = await db.translation.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale: 'th' } } });
    const proposal = await facilityDraft(pool.id);
    await service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(await db.projectAmenity.findUniqueOrThrow({ where: { id: pool.id } })).toMatchObject({ description: 'Reviewed visitor information.',
      published: true, bookingRequired: true, bookingMode: 'time_slot', pricingType: 'paid', priceThb: 15000,
      reservationConfig: pool.reservationConfig, openingHours: pool.openingHours, rules: pool.rules });
    expect(await db.translation.findUniqueOrThrow({ where: { id: originalThai.id } })).toEqual(originalThai);
    expect(await db.translation.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale: 'en' } } })).toMatchObject({ value: 'Reviewed visitor information.', status: 'needs_review' });
  });
  it.each(['insert', 'delete', 'edit'] as const)('locks the canonical facility collection against concurrent %s', async action => {
    const pool = await db.projectAmenity.create({ data: { projectId, slug: 'pool', name: 'Pool' } });
    const proposal = await facilityDraft(pool.id);
    let signalLocked!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { signalLocked = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    let paused = false;
    const pausingDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
        target.$transaction(async tx => run(new Proxy(tx, { get(inner, name) {
          if (name === '$queryRaw') return async (parts: TemplateStringsArray, ...values: unknown[]) => {
            const result = await inner.$queryRaw(parts, ...values);
            if (!paused && parts.join('?').includes('FROM project_amenity') && parts.join('?').includes('FOR UPDATE')) {
              paused = true; signalLocked(); await released;
            }
            return result;
          };
          return Reflect.get(inner, name);
        } })), options);
      return Reflect.get(target, property);
    } });
    const approval = createContentProposalService(pausingDb).review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    await Promise.race([locked, approval.then(() => { throw new Error('Approval bypassed facility lock checkpoint'); })]);
    let signalWriter!: (pid: number) => void;
    const writerPid = new Promise<number>(resolve => { signalWriter = resolve; });
    const writer = db.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      signalWriter(row.pid);
      if (action === 'insert') return tx.projectAmenity.create({ data: { projectId, slug: 'gym', name: 'Gym' } });
      if (action === 'delete') return tx.projectAmenity.delete({ where: { id: pool.id } });
      return tx.projectAmenity.update({ where: { id: pool.id }, data: { name: 'Later canonical edit' } });
    });
    const outcomes = Promise.allSettled([approval, writer]);
    let observedLock = false;
    try {
      const pid = await writerPid;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<{ wait_event_type: string | null }[]>`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
        if (rows[0]?.wait_event_type === 'Lock') { observedLock = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { release(); await outcomes; }
    expect(observedLock).toBe(true); expect((await approval).status).toBe('approved'); await writer;
  });
  it('rejects an unrelated unit pointer alias before changing amenity translations', async () => {
    const pool = await db.projectAmenity.create({ data: { projectId, slug: 'pool', name: 'Pool', description: 'Original pool description' } });
    const key = await db.contentKey.create({ data: { key: `project_amenity.${pool.id}.description`, namespace: 'project_amenity', description: 'Fixture',
      translations: { create: { locale: 'en', value: 'Original shared text', status: 'ok', updatedByIdentityId: author } } } });
    await db.unit.update({ where: { id: unitId }, data: { marketingTitleKey: key.key } });
    const proposal = await facilityDraft(pool.id);
    await expect(service.review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await db.projectAmenity.findUniqueOrThrow({ where: { id: pool.id } })).description).toBe('Original pool description');
    expect((await db.translation.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale: 'en' } } })).value).toBe('Original shared text');
  });
  it('conflicts rather than clobbering a newly inserted amenity content key and rolls canonical edits back', async () => {
    const pool = await db.projectAmenity.create({ data: { projectId, slug: 'pool', name: 'Pool', description: 'Old description' } });
    const proposal = await facilityDraft(pool.id);
    let signalRead!: () => void, release!: () => void;
    const read = new Promise<void>(resolve => { signalRead = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const pausingDb = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
        target.$transaction(async tx => run(new Proxy(tx, { get(inner, name) {
          if (name === 'contentKey') return new Proxy(inner.contentKey, { get(delegate, method) {
            if (method === 'create') return async (args: Prisma.ContentKeyCreateArgs) => {
              signalRead(); await released; return delegate.create(args);
            };
            return Reflect.get(delegate, method);
          } });
          return Reflect.get(inner, name);
        } })), options);
      return Reflect.get(target, property);
    } });
    const approval = createContentProposalService(pausingDb).review(reviewer, proposal.id, { action: 'approve', expectedRevision: 1 });
    await Promise.race([read, approval.then(() => { throw new Error('Approval bypassed amenity key checkpoint'); })]);
    try {
      await db.contentKey.create({ data: { key: `project_amenity.${pool.id}.description`, namespace: 'project_amenity', description: 'Concurrent key',
        translations: { create: { locale: 'en', value: 'Concurrent content', status: 'ok', updatedByIdentityId: reviewer } } } });
    } finally { release(); }
    await expect(approval).rejects.toMatchObject({ code: 'P2002' });
    expect((await db.projectAmenity.findUniqueOrThrow({ where: { id: pool.id } })).description).toBe('Old description');
    expect((await db.crmOpportunity.findUniqueOrThrow({ where: { id: proposal.id } })).requirements).toMatchObject({ status: 'submitted', revision: 1 });
    const key = await db.contentKey.findUniqueOrThrow({ where: { key: `project_amenity.${pool.id}.description` }, include: { translations: true } });
    expect(key.translations[0].value).toBe('Concurrent content');
  });
});
