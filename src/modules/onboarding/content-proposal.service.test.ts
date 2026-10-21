import { beforeEach, describe, expect, it } from 'vitest';
import { contentProposalFailure, CONTENT_PROPOSAL_SOURCE } from './content-proposal.service';
import { harness, fields, foreignMediaId } from './content-proposal.service.test-support';

describe('content proposal service against isolated transactional fixtures', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });
  it('returns allowlisted exact target facts and current gallery only', async () => {
    const result = await h.service.target('author', 'unit', 'managed-legendary-d201');
    expect(result.snapshot.facts).toEqual(fields);
    expect(JSON.stringify(result)).not.toContain('ownerIdentityId');
    expect(JSON.stringify(result)).not.toContain('baseNightlyThb');
    expect(result.snapshot.descriptions).toEqual({ en: 'English original', th: 'Thai original' });
    expect(result.baselineVersion).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects invalid legacy snapshots before storing an unreadable proposal', async () => {
    h.state().units[0].coverMediaId = foreignMediaId;
    await expect(h.create()).rejects.toMatchObject({ status: 409 });
    expect(h.state().rows).toHaveLength(0);
  });
  it('creates only a separate CRM proposal, never canonical data', async () => {
    const result = await h.create();
    expect(result.status).toBe('submitted'); expect(h.state().rows[0].source).toBe(CONTENT_PROPOSAL_SOURCE);
    expect(h.state().rows[0].identityId).toBe('author'); expect(h.state().units[0].ownerIdentityId).toBe('other');
    expect(h.db.unit.update).not.toHaveBeenCalled(); expect(h.db.translation.create).not.toHaveBeenCalled();
  });
  it('includes and applies canonical gross area independently from legacy integer size', async () => {
    const before = await h.service.target('author', 'unit', 'managed-legendary-d201');
    expect(before.snapshot.facts).toMatchObject({ sizeSqm: 41, grossAreaSqm: 42.75 });
    const payload = h.payload(); payload.facts.grossAreaSqm = 48.25;
    const created = await h.create('submitted', payload);
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0]).toMatchObject({ grossAreaSqm: 48.25, sizeSqm: 41 });
  });
  it('rejects stale gross-area baselines and refuses deprecated project facilities input', async () => {
    const created = await h.create(); h.state().units[0].grossAreaSqm = 43.5;
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    Object.assign(h.state().roles[0], { scopeType: 'project', unitId: null });
    const target = await h.service.target('author', 'project', 'project');
    expect(target.snapshot.facts).not.toHaveProperty('facilities');
    await expect(h.service.create('author', { scope: 'project', targetId: 'project', baselineVersion: target.baselineVersion, status: 'draft',
      proposal: { facts: { ...target.snapshot.facts, facilities: ['pool'] }, description: null, gallery: { mediaIds: [], coverMediaId: null } } })).rejects.toThrow('Invalid content proposal');
  });
  it('does not widen a project contributor grant to child units', async () => {
    Object.assign(h.state().roles[0], { scopeType: 'project', unitId: null });
    await expect(h.service.target('author', 'unit', 'managed-legendary-d201')).rejects.toMatchObject({ status: 403 });
    expect((await h.service.target('author', 'project', 'project')).target.scope).toBe('project');
    const list = await h.service.list('author'); expect(list.targets.map(t => t.scope)).toEqual(['project']);
  });
  it('applies a project-scoped proposal without modifying any child unit', async () => {
    Object.assign(h.state().roles[0], { scopeType: 'project', unitId: null });
    const current = await h.service.target('author', 'project', 'project');
    const created = await h.service.create('author', { scope: 'project', targetId: 'project', baselineVersion: current.baselineVersion, status: 'submitted',
      proposal: { facts: { ...current.snapshot.facts, name: 'Reviewed complex' }, description: { locale: 'th', value: 'New Thai project text' },
        gallery: { mediaIds: [], coverMediaId: null } } });
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().projects[0].name).toBe('Reviewed complex');
    expect(h.state().projects[0].facilities).toEqual([]);
    expect(h.db.project.update.mock.calls[0][0].data).not.toHaveProperty('facilities');
    expect(h.state().units[0].name).toBe('D201'); expect(h.db.unit.update).not.toHaveBeenCalled();
  });
  it('does not widen a unit grant to its project or foreign units', async () => {
    await expect(h.service.target('author', 'project', 'project')).rejects.toMatchObject({ status: 403 });
    h.state().units.push({ ...h.state().units[0], id: 'foreign' });
    await expect(h.service.target('author', 'unit', 'foreign')).rejects.toMatchObject({ status: 403 });
  });
  it.each(['ownerIdentityId', 'baseNightlyThb', 'status', 'projectId', 'assetStatus'])('rejects physical fact mass assignment: %s', async key => {
    const payload = h.payload(); (payload.facts as any)[key] = 'malicious';
    await expect(h.create('submitted', payload)).rejects.toThrow('Invalid content proposal');
    expect(h.state().rows).toHaveLength(0);
  });
  it('rejects extra request keys instead of silently stripping them', async () => {
    const current = await h.service.target('author', 'unit', 'managed-legendary-d201');
    await expect(h.service.create('author', { scope: 'unit', targetId: current.target.id, baselineVersion: current.baselineVersion,
      proposal: h.payload(), status: 'draft', identityId: 'other' })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects foreign unattached assets while retaining current assets uploaded by another person', async () => {
    const payload = h.payload(); payload.gallery.mediaIds.push(foreignMediaId);
    await expect(h.create('draft', payload)).rejects.toMatchObject({ status: 403 });
    h.state().assets[1].uploadedByIdentityId = 'author';
    expect((await h.create('draft', payload)).proposal.gallery.mediaIds).toHaveLength(2);
  });
  it.each([{ encrypted: true }, { mimeType: 'image/svg+xml' }, { sizeBytes: 0 }, { storageKey: 'private:sensitive' }, { kind: 'document' }])('rejects unsafe media %j even when already attached', async unsafe => {
    Object.assign(h.state().assets[0], unsafe);
    await expect(h.create()).rejects.toMatchObject({ status: 403 });
  });
  it('applies only allowed fields, preserves other locales and ownership, and audits exactly once on retry', async () => {
    const created = await h.create();
    const approved = await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(approved.status).toBe('approved'); expect(approved.revision).toBe(2);
    expect(h.state().units[0]).toMatchObject({ name: 'D201 improved', ownerIdentityId: 'other', baseNightlyThb: 990000, status: 'draft', assetStatus: 'managed' });
    const newKey = h.state().keys.find((k: any) => k.key === h.state().units[0].descriptionKey);
    expect(h.state().translations.find((t: any) => t.locale === 'en' && t.contentKeyId === newKey.id)).toMatchObject({ value: 'Reviewed English', status: 'needs_review', updatedByIdentityId: 'admin' });
    expect(h.state().translations.find((t: any) => t.locale === 'th' && t.contentKeyId === newKey.id)).toMatchObject({ value: 'Thai original', status: 'ok', updatedByIdentityId: 'other' });
    expect(h.state().translations.find((t: any) => t.locale === 'en' && t.contentKeyId === 'content').value).toBe('English original');
    const retry = await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(retry).toHaveProperty('alreadyApproved', true); expect(h.state().audit).toHaveLength(1);
    expect(h.db.unit.update).toHaveBeenCalledTimes(1);
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 99 })).rejects.toMatchObject({ status: 409 });
  });
  it.each(['facts', 'translation', 'gallery', 'cover', 'timestamp'])('rejects stale baseline after canonical %s changes', async change => {
    const created = await h.create();
    if (change === 'facts') h.state().units[0].bedrooms = 4;
    if (change === 'translation') h.state().translations[1].value = 'Changed Thai';
    if (change === 'gallery') h.state().unitMedia[0].sort = 17;
    if (change === 'cover') h.state().units[0].coverMediaId = null;
    if (change === 'timestamp') h.state().units[0].updatedAt = new Date('2026-02-01');
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(h.state().audit).toHaveLength(0);
  });
  it('does not approve two distinct proposals from the same baseline', async () => {
    const first = await h.create(), second = await h.create();
    await h.service.review('admin', first.id, { action: 'approve', expectedRevision: 1 });
    await expect(h.service.review('admin', second.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it.each(['revoked', 'blocked', 'scope_changed'])('rechecks author grant/identity at approval: %s', async mode => {
    const created = await h.create();
    if (mode === 'revoked') h.state().roles[0].status = 'revoked';
    if (mode === 'blocked') h.state().identities[0].status = 'blocked';
    if (mode === 'scope_changed') h.state().roles[0].unitId = 'foreign';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(h.service.get('author', created.id)).rejects.toMatchObject({ status: 403 });
    expect(h.db.unit.update).not.toHaveBeenCalled();
  });
  it('rejects blocked admin, non-admin review, author impersonation, and foreign reads', async () => {
    const created = await h.create();
    await expect(h.service.review('author', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(h.service.get('other', created.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.service.update('admin', created.id, { expectedRevision: 1, action: 'rebase' })).rejects.toMatchObject({ status: 404 });
    h.state().identities[2].status = 'blocked';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
  });
  it('supports return, explicit destructive rebase, revise, and resubmit', async () => {
    const created = await h.create();
    await expect(h.service.review('admin', created.id, { action: 'return', expectedRevision: 1 })).rejects.toMatchObject({ status: 400 });
    const returned = await h.service.review('admin', created.id, { action: 'return', expectedRevision: 1, note: 'Please verify photos.' });
    expect(returned.reviewNote).toBe('Please verify photos.');
    h.state().units[0].bedrooms = 3;
    await expect(h.service.update('author', created.id, { expectedRevision: 2, proposal: h.payload(), status: 'submitted' })).rejects.toMatchObject({ status: 409 });
    const rebased = await h.service.update('author', created.id, { expectedRevision: 2, action: 'rebase' });
    expect(rebased.proposal.description).toBeNull(); expect((rebased.proposal.facts as any).bedrooms).toBe(3); expect(rebased.status).toBe('draft');
    const resubmitted = await h.service.update('author', created.id, { expectedRevision: 3, proposal: rebased.proposal, status: 'submitted' });
    expect(resubmitted.revision).toBe(4); expect(resubmitted.status).toBe('submitted');
  });
  it('rejects schema-corrupt stored proposals and mismatched CRM target binding', async () => {
    const created = await h.create();
    h.state().rows[0].requirements.proposal.facts.ownerIdentityId = 'author';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    delete h.state().rows[0].requirements.proposal.facts.ownerIdentityId;
    h.state().rows[0].unitId = 'foreign';
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it('conflicts on shared or incompatible description keys', async () => {
    const created = await h.create();
    h.state().units.push({ ...h.state().units[0], id: 'another-unit' });
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(h.db.translation.create).not.toHaveBeenCalled();
  });
  it('copy-on-write leaves cancellation/handbook aliases untouched and preserves other locale metadata', async () => {
    h.state().units.push({ ...h.state().units[0], id: 'another', descriptionKey: null, cancellationPolicyKey: 'unit.d201.description' });
    h.state().projects[0].handbookKey = 'unit.d201.description';
    const originalThai = structuredClone(h.state().translations[1]);
    const created = await h.create();
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().translations.find((t: any) => t.id === 'translation-en').value).toBe('English original');
    const copiedThai = h.state().translations.find((t: any) => t.contentKeyId !== 'content' && t.locale === 'th');
    expect(copiedThai).toMatchObject({ value: originalThai.value, status: originalThai.status, updatedByIdentityId: originalThai.updatedByIdentityId,
      createdAt: originalThai.createdAt, updatedAt: originalThai.updatedAt });
    expect(h.state().units[1].cancellationPolicyKey).toBe('unit.d201.description');
    expect(h.state().projects[0].handbookKey).toBe('unit.d201.description');
  });
  it('fails a proposal-specific key collision atomically, never upserting an existing key', async () => {
    const created = await h.create();
    h.db.contentKey.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ code: 'P2002' });
    expect(h.state().units[0].descriptionKey).toBe('unit.d201.description');
    expect(h.state().audit).toHaveLength(0); expect(h.db.translation.create).not.toHaveBeenCalled();
  });
  it('replaces an unmaterialized canonical description pointer with a new unique key', async () => {
    h.state().keys = []; h.state().translations = [];
    const created = await h.create();
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].descriptionKey).toBe(`unit.managed-legendary-d201.proposal.${created.id}.description`);
  });
  it('pins the original title key and leaves all localized marketing titles and metadata untouched', async () => {
    const original = { id: 'old-title', key: 'unit.d201.title', namespace: 'unit', description: 'Marketing title', supportsRich: false,
      createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-02-01') };
    h.state().keys.push(original);
    const en = { id: 'title-en', contentKeyId: original.id, locale: 'en', value: 'Sunny corner home', status: 'ok', updatedByIdentityId: 'other', createdAt: original.createdAt, updatedAt: original.updatedAt };
    const ru = { ...en, id: 'title-ru', locale: 'ru', value: 'Солнечная квартира', status: 'needs_review' };
    h.state().translations.push(en, ru);
    const proposal = await h.create();
    await h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].marketingTitleKey).toBe(original.key);
    expect(h.state().keys.find((key: any) => key.key === original.key)).toEqual(original);
    expect(h.state().keys.some((key: any) => key.key.endsWith(`proposal.${proposal.id}.title`))).toBe(false);
    for (const previous of [en, ru]) expect(h.state().translations.find((t: any) => t.id === previous.id)).toEqual(previous);
    expect(h.db.contentKey.create).toHaveBeenCalledTimes(1);
  });
  it('hashes the resolved title revisions and conflicts when a title changes before review', async () => {
    h.state().keys.push({ id: 'old-title', key: 'unit.d201.title', namespace: 'unit', description: 'Title', supportsRich: false, updatedAt: new Date('2025-01-01') });
    const proposal = await h.create();
    h.state().keys[1].updatedAt = new Date('2025-02-01');
    await expect(h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it('pins an absent original title name without creating a key or inventing text', async () => {
    const proposal = await h.create();
    await h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].marketingTitleKey).toBe('unit.d201.title');
    expect(h.state().keys.filter((key: any) => key.key.endsWith('.title'))).toEqual([]);
  });
  it('keeps a title created after the missing-title baseline read reachable', async () => {
    const proposal = await h.create();
    const create = h.db.contentKey.create.getMockImplementation()!;
    h.db.contentKey.create.mockImplementationOnce(async (args: any) => {
      h.state().keys.push({ id: 'late-title', key: 'unit.d201.title', namespace: 'unit', supportsRich: false });
      h.state().translations.push({ id: 'late-en', contentKeyId: 'late-title', locale: 'en', value: 'Late title', status: 'ok' });
      return create(args);
    });
    await h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].marketingTitleKey).toBe('unit.d201.title');
    const title = h.state().keys.find((key: any) => key.key === h.state().units[0].marketingTitleKey);
    expect(h.state().translations.find((t: any) => t.contentKeyId === title.id).value).toBe('Late title');
  });
  it('preserves an existing explicit title pointer instead of deriving or copying another key', async () => {
    h.state().units[0].marketingTitleKey = 'editorial.special.title';
    const proposal = await h.create();
    await h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].marketingTitleKey).toBe('editorial.special.title');
    expect(h.db.unit.update.mock.calls[0][0].data).not.toHaveProperty('marketingTitleKey');
    expect(h.db.contentKey.create).toHaveBeenCalledTimes(1);
  });
  it('hashes the explicit title pointer even when its content key is absent', async () => {
    const proposal = await h.create();
    h.state().units[0].marketingTitleKey = 'editorial.new.title';
    await expect(h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it('does not pin or modify the title pointer for a facts-only approval', async () => {
    const payload = { ...h.payload(), description: null };
    const proposal = await h.create('submitted', payload);
    await h.service.review('admin', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].marketingTitleKey).toBeNull();
    expect(h.db.contentKey.create).not.toHaveBeenCalled();
  });
  it('creates a unique missing description key at approval', async () => {
    h.state().units[0].descriptionKey = null;
    const created = await h.create();
    await h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 });
    expect(h.state().units[0].descriptionKey).toBe(`unit.managed-legendary-d201.proposal.${created.id}.description`);
  });
  it('rolls back canonical writes when the final audit fails', async () => {
    const created = await h.create();
    h.db.auditLog.create.mockRejectedValueOnce(new Error('simulated audit failure'));
    await expect(h.service.review('admin', created.id, { action: 'approve', expectedRevision: 1 })).rejects.toThrow('simulated audit failure');
    expect(h.state().units[0].name).toBe('D201'); expect(h.state().translations[0].value).toBe('English original');
    expect(h.state().rows[0].requirements.status).toBe('submitted'); expect(h.state().audit).toHaveLength(0);
  });
  it('does not expose a foreign proposed asset URL and limits author attribution to admin detail', async () => {
    const created = await h.create();
    h.state().rows[0].requirements.proposal.gallery.mediaIds.push(foreignMediaId);
    const own = await h.service.get('author', created.id);
    expect(own.media.map(m => m.id)).not.toContain(foreignMediaId);
    expect(JSON.stringify(own)).not.toContain('foreign.jpg'); expect(own).not.toHaveProperty('author');
    const admin = await h.service.get('admin', created.id);
    expect(admin.author).toEqual({ id: 'author', name: 'author' });
    expect(JSON.stringify(admin)).not.toContain('foreign.jpg');
  });
  it('returns safe unknown and database conflict errors', () => {
    expect(contentProposalFailure(new Error('SQL password=secret'))).toEqual({ status: 500, error: 'Content proposal could not be processed.' });
    expect(contentProposalFailure({ code: 'P2034', message: 'SQL secret' }).status).toBe(409);
  });
});
