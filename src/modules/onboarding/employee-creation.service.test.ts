import { describe, expect, it } from 'vitest';
import { employeeHarness, requestId, nextRequestId } from './employee-creation.test-support';
import { employeeCreationFailure, assertNoEmployeeCreationInput, employeeCreationForConversionTx, hasEmployeeCreatedTargetAccessTx, readEmployeeCreationReceipt } from './employee-creation.service';
import { createContentProposalService } from './content-proposal.service';

const review = { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false };
describe('employee descriptive creation: controlled receipts and current explicit scope (fake Prisma)', () => {
  it('creates intake with no canonical inventory, mandate, role, ownership or operational attachment', async () => {
    const h = employeeHarness(), before = structuredClone(h.state());
    const result = await h.service.create('author', h.unitInput());
    expect(result).toMatchObject({ status: 'submitted', revision: 1, lastRequestId: requestId, createdProjectId: null, createdUnitId: null });
    expect(h.state().rows[0].requirements.employeeCreation).toMatchObject({ applicationId: result.id, creatorIdentityId: 'author', membershipId: 'membership', spaceId: 'space', organizationId: 'org', kind: 'unit', scopeProjectId: 'project' });
    for (const key of ['units', 'projects', 'roles', 'engagements', 'attachments', 'organizations']) expect(h.state()[key]).toEqual(before[key]);
    expect(h.state().audits).toHaveLength(1);
  });
  it('allows create-only staff with no legacy operational or content roles', async () => {
    const h = employeeHarness(); h.state().members[0].capabilities = ['create_unit'];
    expect((await h.service.list('author')).spaces[0]).toMatchObject({ canCreateUnit: true, canCreateComplex: false, projects: [{ id: 'project', name: 'Existing project' }] });
    await expect(h.service.create('author', h.unitInput())).resolves.toMatchObject({ kind: 'unit' });
  });
  it.each(['create_unit', 'create_complex'])('keeps %s independent of the other creation grant', async capability => {
    const h = employeeHarness(); h.state().members[0].capabilities = [capability];
    await expect(h.service.create('author', capability === 'create_unit' ? h.complexInput() : h.unitInput())).rejects.toMatchObject({ status: 403 });
    expect(h.state().rows).toHaveLength(0);
  });
  it.each(['inactive-member', 'inactive-space', 'inactive-org', 'blocked-identity', 'empty-portfolio', 'detached', 'expired-attachment', 'expired-role', 'unverified-role', 'offboarded-unit', 'archived-project', 'wrong-project', 'legacy-only', 'admin-without-member'])('fails closed for %s', async scenario => {
    const h = employeeHarness();
    if (scenario === 'inactive-member') h.state().members[0].active = false;
    if (scenario === 'inactive-space') h.state().spaces[0].status = 'inactive';
    if (scenario === 'inactive-org') h.state().organizations[0].status = 'inactive';
    if (scenario === 'blocked-identity') h.state().identities[0].status = 'blocked';
    if (scenario === 'empty-portfolio') h.state().attachments = [];
    if (scenario === 'detached') h.state().attachments[0].active = false;
    if (scenario === 'expired-attachment') h.state().attachments[0].endsOn = new Date('2020-01-01');
    if (scenario === 'expired-role') h.state().projectRoles[0].effectiveTo = new Date('2020-01-01');
    if (scenario === 'unverified-role') h.state().projectRoles[0].provenance = 'claimed';
    if (scenario === 'offboarded-unit') h.state().units[0].status = 'offboarded';
    if (scenario === 'archived-project') h.state().projects[0].status = 'archived';
    if (scenario === 'legacy-only') h.state().members[0].capabilities = ['manage_tasks'];
    if (scenario === 'admin-without-member') { h.state().members = []; h.state().identities[0].isAdmin = true; }
    await expect(h.service.create('author', h.unitInput(scenario === 'wrong-project' ? { projectId: 'foreign' } : {}))).rejects.toMatchObject({ status: 403 });
    expect(h.state().rows).toHaveLength(0);
  });
  it.each(['baseNightlyThb', 'proposedNightlyBaht', 'offers', 'instantBook', 'ownerIdentityId', 'operatingModel', 'managementOrgId', 'status', 'employeeCreation', 'published'])('rejects forbidden descriptive field %s', async key => {
    const h = employeeHarness(); const input = h.unitInput(); input.draft[key] = key === 'employeeCreation' ? {} : true;
    await expect(h.service.create('author', input)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects cross-kind smuggling and receipt injection at the top level', async () => {
    const h = employeeHarness();
    await expect(h.service.create('author', h.unitInput({ draft: { ...h.unitInput().draft, proposedProject: 'Smuggled' } }))).rejects.toMatchObject({ status: 400 });
    await expect(h.service.create('author', h.complexInput({ draft: { ...h.complexInput().draft, unitName: 'Smuggled' } }))).rejects.toMatchObject({ status: 400 });
    await expect(h.service.create('author', { ...h.unitInput(), employeeCreation: {} })).rejects.toMatchObject({ status: 400 });
    expect(() => assertNoEmployeeCreationInput({ requirements: { employeeCreation: null } })).toThrow();
    expect(() => assertNoEmployeeCreationInput({ employeeCreation: null })).toThrow();
  });
  it('replays the same request once, rejects changed payload and exposes exact readback', async () => {
    const h = employeeHarness(), first = await h.service.create('author', h.unitInput());
    expect(await h.service.create('author', h.unitInput())).toEqual(first);
    expect(h.state().rows).toHaveLength(1); expect(h.state().audits).toHaveLength(1);
    await expect(h.service.create('author', h.unitInput({ draft: { ...h.unitInput().draft, unitName: 'Other' } }))).rejects.toMatchObject({ status: 409 });
    expect(await h.service.byRequest('author', requestId)).toMatchObject({ item: { id: first.id }, requestReceipt: { requestId, revision: 1, status: 'submitted' } });
    expect(await h.service.byRequest('other', requestId)).toEqual({ item: null, requestReceipt: null });
  });
  it('uses CAS revisions, immutable scope, same-ID save recovery and no writes after submit', async () => {
    const h = employeeHarness(), first = await h.service.create('author', h.unitInput({ status: 'draft' }));
    const update = { id: first.id, requestId: nextRequestId, expectedRevision: 1, status: 'submitted', draft: h.unitInput().draft };
    const second = await h.service.update('author', update);
    expect(second).toMatchObject({ revision: 2, status: 'submitted' });
    expect(await h.service.update('author', update)).toEqual(second);
    await expect(h.service.update('author', { ...update, requestId: '00000000-0000-4000-8000-000000000003' })).rejects.toMatchObject({ status: 409 });
    await expect(h.service.update('author', { ...update, projectId: 'elsewhere' })).rejects.toMatchObject({ status: 400 });
    expect((await h.service.byRequest('author', requestId)).requestReceipt?.revision).toBe(1);
    expect(h.state().audits).toHaveLength(2);
  });
  it('checks authority on replay, read and conversion, including original membership identity', async () => {
    const h = employeeHarness(), first = await h.service.create('author', h.unitInput());
    h.state().members[0].id = 'replacement-membership';
    await expect(h.service.get('author', first.id)).resolves.toMatchObject({ mayEdit: false, hasCreationAccess: false, createdProjectId: null, createdUnitId: null });
    expect((await h.service.list('author')).items).toHaveLength(1);
    expect((await h.service.byRequest('author', requestId)).requestReceipt?.revision).toBe(1);
    await expect(h.service.create('author', h.unitInput())).rejects.toMatchObject({ status: 403 });
    await expect(employeeCreationForConversionTx(h.db, h.state().rows[0], 'reviewer', review)).rejects.toMatchObject({ status: 403 });
  });
  it('revocation retains only creator intake, never canonical enrichment, and a blocked identity loses all reads', async () => {
    const h = await convertedFixture(); const id = h.state().rows[0].id;
    h.state().units[1].name = 'Later private canonical enrichment';
    h.state().members[0].active = false;
    const visible = await h.service.get('author', id);
    expect(visible).toMatchObject({ hasCreationAccess: false, mayEdit: false, createdUnitId: null, createdProjectId: null });
    expect(visible.draft.unitName).toBe('A102'); expect(JSON.stringify(visible)).not.toContain('private canonical');
    await expect(h.service.get('other', id)).rejects.toMatchObject({ status: 404 });
    h.state().identities[0].status = 'blocked';
    await expect(h.service.get('author', id)).rejects.toMatchObject({ status: 403 });
    await expect(h.service.list('author')).rejects.toMatchObject({ status: 403 });
    await expect(h.service.byRequest('author', requestId)).rejects.toMatchObject({ status: 403 });
  });
  it('rejects malformed provenance, cross-CRM replay and mismatched relational columns', async () => {
    const h = employeeHarness(); await h.service.create('author', h.unitInput());
    const row = structuredClone(h.state().rows[0]);
    expect(() => readEmployeeCreationReceipt({ ...row, id: 'forged' })).toThrow();
    expect(() => readEmployeeCreationReceipt({ ...row, identityId: 'other' })).toThrow();
    expect(() => readEmployeeCreationReceipt({ ...row, projectId: 'foreign' })).toThrow();
    expect(() => readEmployeeCreationReceipt({ ...row, requirements: { ...row.requirements, employeeCreation: null } })).toThrow();
  });
  it('requires a live reviewer and rejects ownership or unit project reassignment', async () => {
    const h = employeeHarness(); await h.service.create('author', h.unitInput());
    await expect(employeeCreationForConversionTx(h.db, h.state().rows[0], 'other', review)).rejects.toMatchObject({ status: 403 });
    await expect(employeeCreationForConversionTx(h.db, h.state().rows[0], 'reviewer', { ...review, verifiedOwner: true })).rejects.toMatchObject({ status: 400 });
    await expect(employeeCreationForConversionTx(h.db, h.state().rows[0], 'reviewer', { ...review, projectId: 'foreign' })).rejects.toMatchObject({ status: 403 });
  });
  it('locks identity, workspace, member, attachment and evidence rows before a write', async () => {
    const h = employeeHarness(); await h.service.create('author', h.unitInput());
    const sql = h.db.$queryRaw.mock.calls.map((call: any) => call[0].join('?')).join('\n');
    for (const table of ['identity', 'operating_space', 'organization', 'operating_space_member', 'operating_space_unit', 'unit', 'project', 'unit_engagement', 'project_organization_role']) expect(sql).toMatch(new RegExp(`FROM ${table} .*FOR SHARE`));
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });
  it('rolls back intake if the audit fails; does not retry an ambiguous transaction', async () => {
    const h = employeeHarness(); h.db.auditLog.create.mockRejectedValueOnce({ code: 'P2028' });
    await expect(h.service.create('author', h.unitInput())).rejects.toMatchObject({ code: 'P2028' });
    expect(h.state().rows).toHaveLength(0); expect(h.db.$transaction).toHaveBeenCalledTimes(1);
  });
});

async function convertedFixture(created = true) {
  const h = employeeHarness(); await h.service.create('author', h.unitInput());
  const row = h.state().rows[0]; row.unitId = created ? 'created-unit' : 'attached';
  row.requirements.status = 'converted'; row.requirements.canonicalProjectId = 'project'; row.requirements.canonicalUnitId = row.unitId;
  row.requirements.employeeCreation.createdUnitId = created ? row.unitId : null;
  if (created) h.state().units.push({ ...h.state().units[0], id: row.unitId, name: 'Created home', status: 'draft' });
  return h;
}
describe('receipt-derived content proposals preserve canonical review gates (fake Prisma)', () => {
  const target = { scope: 'unit' as const, id: 'created-unit', projectId: 'project' };
  it('allows only the exact newly-created DRAFT unit and never its parent, sibling, or matched record', async () => {
    const h = await convertedFixture();
    expect(await hasEmployeeCreatedTargetAccessTx(h.db, 'author', target)).toBe(true);
    for (const candidate of [{ ...target, id: 'attached' }, { ...target, projectId: 'foreign' }, { scope: 'project' as const, id: 'project', projectId: 'project' }]) expect(await hasEmployeeCreatedTargetAccessTx(h.db, 'author', candidate)).toBe(false);
    expect(await hasEmployeeCreatedTargetAccessTx(h.db, 'other', target)).toBe(false);
    const matched = await convertedFixture(false);
    expect(await hasEmployeeCreatedTargetAccessTx(matched.db, 'author', { ...target, id: 'attached' })).toBe(false);
  });
  it.each(['published', 'moved', 'revoked', 'org-inactive', 'detached'])('ends derived content access after %s', async scenario => {
    const h = await convertedFixture();
    if (scenario === 'published') h.state().units[1].status = 'live';
    if (scenario === 'moved') h.state().units[1].projectId = 'elsewhere';
    if (scenario === 'revoked') h.state().members[0].capabilities = [];
    if (scenario === 'org-inactive') h.state().organizations[0].status = 'inactive';
    if (scenario === 'detached') h.state().attachments[0].active = false;
    let allowed = false;
    try { allowed = await hasEmployeeCreatedTargetAccessTx(h.db, 'author', target); } catch { /* fail closed */ }
    expect(allowed).toBe(false);
  });
  it('approves a receipt-derived descriptive proposal while preserving DRAFT state and operational isolation', async () => {
    const h = await convertedFixture(), service = createContentProposalService(h.db);
    const current = await service.target('author', 'unit', target.id);
    const proposal = await service.create('author', { scope: 'unit', targetId: target.id, baselineVersion: current.baselineVersion, status: 'submitted',
      proposal: { facts: { ...current.snapshot.facts, name: 'Reviewed created home' }, description: null, gallery: { mediaIds: [], coverMediaId: null } } });
    const result = await service.review('reviewer', proposal.id, { action: 'approve', expectedRevision: 1 });
    expect(result).toMatchObject({ status: 'approved', alreadyApproved: false });
    expect(h.state().units[1]).toMatchObject({ name: 'Reviewed created home', status: 'draft', projectId: 'project' });
    expect(h.state().attachments).toHaveLength(1); expect(h.state().engagements).toHaveLength(0); expect(h.state().roles).toHaveLength(0);
  });
  it('submits a reviewed content proposal without direct canonical writes, then blocks revoked approval', async () => {
    const h = await convertedFixture(), service = createContentProposalService(h.db);
    const current = await service.target('author', 'unit', target.id);
    const proposal = await service.create('author', { scope: 'unit', targetId: target.id, baselineVersion: current.baselineVersion, status: 'submitted',
      proposal: { facts: { ...current.snapshot.facts, name: 'Content review only' }, description: null, gallery: { mediaIds: [], coverMediaId: null } } });
    expect(h.state().units[1].name).toBe('Created home');
    h.state().members[0].capabilities = [];
    await expect(service.review('reviewer', proposal.id, { action: 'approve', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    expect(h.state().units[1].name).toBe('Created home');
  });
});

describe('employee creation public error mapping', () => {
  it.each(['40P01', '40001', '55P03'])('maps known PostgreSQL rollback %s to conflict without automatic retry', code => {
    expect(employeeCreationFailure({ code: 'P2010', meta: { code }, message: 'private SQL' }).status).toBe(409);
  });
  it.each([new Error('private SQL'), { code: 'P2010', meta: { code: 'XX000' }, message: 'private SQL' }, { code: 'UNKNOWN', meta: { code: '40001' } }])('does not expose or misclassify arbitrary failures', error => {
    expect(employeeCreationFailure(error)).toEqual({ status: 500, error: 'Property creation could not be processed.' });
  });
});
