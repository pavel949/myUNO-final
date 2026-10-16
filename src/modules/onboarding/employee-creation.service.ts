import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getEmployeeCreationAccessTx } from './employee-creation-access';
import { creationExact, creationId, creationKind, creationObject, creationRequestId, creationRevision,
  EmployeeCreationError, parseEmployeeCreationCreate, parseEmployeeCreationDraft, parseEmployeeCreationUpdate,
  type EmployeeCreationDraft, type EmployeeCreationKind, type EmployeeCreationStatus,
  EMPLOYEE_UNIT_FIELDS, EMPLOYEE_COMPLEX_FIELDS, hasEmployeeCreationReceipt } from './employee-creation.schema';

export const EMPLOYEE_SUBMISSION_SOURCE = 'myuno_property_submission_v1';
type Tx = Prisma.TransactionClient;
type RequestReceipt = { requestId: string; fingerprint: string; revision: number; status: EmployeeCreationStatus };
export type EmployeeCreationReceipt = {
  version: 1; applicationId: string; creatorIdentityId: string; spaceId: string; organizationId: string; membershipId: string;
  kind: EmployeeCreationKind; scopeProjectId: string | null; revision: number; requests: RequestReceipt[];
  createdProjectId: string | null; createdUnitId: string | null;
};
const ROW_SELECT = { id: true, identityId: true, source: true, projectId: true, unitId: true, requirements: true, updatedAt: true } as const;
type Row = Prisma.CrmOpportunityGetPayload<{ select: typeof ROW_SELECT }>;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const conflict = (): never => { throw new EmployeeCreationError(409, 'This creation request changed. Reload it before continuing.'); };
const denied = (): never => { throw new EmployeeCreationError(403, 'Current property creation permission is required.'); };
const missing = (): never => { throw new EmployeeCreationError(404, 'Creation request not found.'); };
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value !== null && typeof value === 'object'
  ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
const fingerprint = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
export { hasEmployeeCreationReceipt, assertNoEmployeeCreationInput } from './employee-creation.schema';
export function readEmployeeCreationReceipt(row: Pick<Row, 'id' | 'identityId' | 'source' | 'projectId' | 'unitId' | 'requirements'>): EmployeeCreationReceipt | null {
  if (!hasEmployeeCreationReceipt(row.requirements)) return null;
  try {
    const data = creationObject(row.requirements);
    const value = creationExact(data.employeeCreation, ['version', 'applicationId', 'creatorIdentityId', 'spaceId', 'organizationId', 'membershipId',
      'kind', 'scopeProjectId', 'revision', 'requests', 'createdProjectId', 'createdUnitId']);
    const receipt: EmployeeCreationReceipt = { version: 1, applicationId: creationId(value.applicationId), creatorIdentityId: creationId(value.creatorIdentityId),
      spaceId: creationId(value.spaceId), organizationId: creationId(value.organizationId), membershipId: creationId(value.membershipId), kind: creationKind(value.kind),
      scopeProjectId: value.scopeProjectId === null ? null : creationId(value.scopeProjectId), revision: creationRevision(value.revision),
      createdProjectId: value.createdProjectId === null ? null : creationId(value.createdProjectId), createdUnitId: value.createdUnitId === null ? null : creationId(value.createdUnitId), requests: [] };
    if (value.version !== 1 || row.source !== EMPLOYEE_SUBMISSION_SOURCE || receipt.applicationId !== row.id || receipt.creatorIdentityId !== row.identityId ||
      (receipt.kind === 'unit' ? !receipt.scopeProjectId || receipt.createdProjectId !== null : receipt.scopeProjectId !== null || receipt.createdUnitId !== null) ||
      !Array.isArray(value.requests) || !value.requests.length || value.requests.length > 200 || !['draft', 'submitted', 'converted'].includes(String(data.status))) return conflict();
    receipt.requests = value.requests.map(entry => {
      const request = creationExact(entry, ['requestId', 'fingerprint', 'revision', 'status']);
      if (typeof request.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(request.fingerprint) || !['draft', 'submitted'].includes(String(request.status))) return conflict();
      return { requestId: creationRequestId(request.requestId), fingerprint: request.fingerprint, revision: creationRevision(request.revision), status: request.status as EmployeeCreationStatus };
    });
    if (receipt.requests.length !== receipt.revision || new Set(receipt.requests.map(entry => entry.requestId)).size !== receipt.requests.length ||
      receipt.requests.some((entry, index) => entry.revision !== index + 1) || data.kind !== (receipt.kind === 'unit' ? 'home' : 'resort')) return conflict();
    if (data.status === 'converted') {
      if (typeof data.canonicalProjectId !== 'string' || row.projectId !== data.canonicalProjectId || row.unitId !== data.canonicalUnitId ||
        (receipt.kind === 'unit' && (row.projectId !== receipt.scopeProjectId || !row.unitId)) ||
        (receipt.kind === 'complex' && row.unitId !== null) ||
        (receipt.createdProjectId && receipt.createdProjectId !== row.projectId) || (receipt.createdUnitId && receipt.createdUnitId !== row.unitId)) return conflict();
    } else if (row.projectId !== receipt.scopeProjectId || row.unitId !== null || receipt.createdProjectId || receipt.createdUnitId ||
      data.canonicalProjectId !== undefined || data.canonicalUnitId !== undefined) return conflict();
    return receipt;
  } catch { return conflict(); }
}
function draftOf(row: Pick<Row, 'requirements'>, receipt: EmployeeCreationReceipt): EmployeeCreationDraft {
  const data = creationObject(row.requirements);
  const fields = ['description', 'descriptionLocale', ...(receipt.kind === 'unit' ? EMPLOYEE_UNIT_FIELDS : EMPLOYEE_COMPLEX_FIELDS)];
  // Unknown commercial or operational fields on governed rows are corruption,
  // not values the conversion may silently begin honoring.
  const allowed = [...fields, 'kind', 'status', 'employeeCreation', 'canonicalProjectId', 'canonicalUnitId',
    'onboardingState', 'onboardingBlockers', 'convertedAt', 'reviewedByIdentityId'];
  if (Object.keys(data).some(key => !allowed.includes(key))) return conflict();
  return parseEmployeeCreationDraft(receipt.kind, Object.fromEntries(fields.filter(key => key in data).map(key => [key, data[key]])), data.status === 'draft' ? 'draft' : 'submitted');
}
function detail(row: Row, receipt: EmployeeCreationReceipt) {
  return { id: row.id, spaceId: receipt.spaceId, organizationId: receipt.organizationId, kind: receipt.kind,
    projectId: receipt.scopeProjectId, status: creationObject(row.requirements).status as 'draft' | 'submitted' | 'converted', revision: receipt.revision,
    draft: draftOf(row, receipt), matchedExisting: creationObject(row.requirements).status === 'converted' && !receipt.createdProjectId && !receipt.createdUnitId, hasCreationAccess: true, mayEdit: creationObject(row.requirements).status === 'draft', lastRequestId: receipt.requests[receipt.requests.length - 1].requestId,
    createdProjectId: receipt.createdProjectId, createdUnitId: receipt.createdUnitId };
}
async function access(tx: Tx, receipt: EmployeeCreationReceipt) {
  const current = await getEmployeeCreationAccessTx(tx, receipt.creatorIdentityId, receipt.spaceId, receipt.kind, receipt.scopeProjectId, receipt.organizationId);
  if (current.membershipId !== receipt.membershipId) return denied();
  return current;
}
async function owned(tx: Tx, actorId: string, id: string, lock = false, requireAccess = true) {
  if (lock) await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${id} FOR UPDATE`;
  const row = await tx.crmOpportunity.findUnique({ where: { id }, select: ROW_SELECT });
  if (!row || row.identityId !== actorId) return missing();
  const receipt = readEmployeeCreationReceipt(row);
  if (!receipt) return missing();
  if (requireAccess) await access(tx, receipt);
  else {
    await tx.$queryRaw`SELECT id FROM identity WHERE id = ${actorId} FOR SHARE`;
    const actor = await tx.identity.findUnique({ where: { id: actorId }, select: { status: true } });
    if (!actor || actor.status !== 'active') return denied();
  }
  return { row, receipt };
}
/** Revocation ends mutation authority, not the creator's ability to read
 * their own submitted description and recover an uncertain save result. */
async function visibleDetail(tx: Tx, row: Row, receipt: EmployeeCreationReceipt) {
  let hasCreationAccess = false;
  try { await access(tx, receipt); hasCreationAccess = true; }
  catch (error) { if (!(error instanceof EmployeeCreationError)) throw error; }
  let createdProjectId: string | null = null, createdUnitId: string | null = null;
  if (hasCreationAccess && row.projectId) {
    const output = receipt.createdUnitId ?? receipt.createdProjectId;
    if (output && await hasEmployeeCreatedTargetAccessTx(tx, row.identityId, {
      scope: receipt.kind === 'unit' ? 'unit' : 'project', id: output, projectId: row.projectId,
    })) { createdProjectId = receipt.createdProjectId; createdUnitId = receipt.createdUnitId; }
  }
  return { ...detail(row, receipt), hasCreationAccess,
    mayEdit: hasCreationAccess && creationObject(row.requirements).status === 'draft', createdProjectId, createdUnitId };
}
async function requestRow(tx: Tx, actorId: string, requestId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM crm_opportunity
    WHERE identity_id = ${actorId} AND source = ${EMPLOYEE_SUBMISSION_SOURCE}
      AND requirements->'employeeCreation'->'requests' @> jsonb_build_array(jsonb_build_object('requestId', ${requestId}::text)) LIMIT 2`;
  if (rows.length > 1) return conflict();
  return rows[0]?.id ?? null;
}
async function validateDraft(tx: Tx, actorId: string, draft: EmployeeCreationDraft, current: Awaited<ReturnType<typeof access>>, projectId: string | null) {
  if (draft.existingUnitId && !current.units.some(unit => unit.id === draft.existingUnitId && unit.projectId === projectId)) return denied();
  if (draft.areaId) {
    const area = await tx.area.findUnique({ where: { id: draft.areaId }, select: { status: true } });
    if (!area || area.status !== 'live') throw new EmployeeCreationError(400, 'Choose a live canonical area.');
  }
  const ids = [...(draft.photos ?? []), ...(draft.projectPhotos ?? [])];
  if (!ids.length) return;
  await tx.$queryRaw`SELECT id FROM media_asset WHERE id = ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
  const assets = await tx.mediaAsset.findMany({ where: { id: { in: ids }, uploadedByIdentityId: actorId, kind: 'photo', encrypted: false,
    sizeBytes: { gt: 0 }, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] }, deleteAfter: null }, select: { id: true } });
  if (assets.length !== ids.length) throw new EmployeeCreationError(403, 'Use your uploaded public photographs.');
}
/** Rechecked within the existing admin conversion transaction, before its
 * idempotent response. Conversion never creates operational authority. */
export async function employeeCreationForConversionTx(tx: Tx, row: Parameters<typeof readEmployeeCreationReceipt>[0], reviewerId: string, review: Record<string, unknown>) {
  const receipt = readEmployeeCreationReceipt(row);
  if (!receipt) return null;
  await tx.$queryRaw`SELECT id FROM identity WHERE id = ${reviewerId} FOR SHARE`;
  const reviewer = await tx.identity.findUnique({ where: { id: reviewerId }, select: { status: true, isAdmin: true } });
  if (!reviewer || reviewer.status !== 'active' || !reviewer.isAdmin) return denied();
  const current = await access(tx, receipt), draft = draftOf(row, receipt);
  await validateDraft(tx, receipt.creatorIdentityId, draft, current, receipt.scopeProjectId);
  if (review.verifiedOwner === true || (review.organizationId != null && review.organizationId !== '' && review.organizationId !== receipt.organizationId)) {
    throw new EmployeeCreationError(400, 'Employee creation does not record ownership or a management mandate.');
  }
  if (receipt.kind === 'unit' && review.projectId && review.projectId !== receipt.scopeProjectId) return denied();
  if (review.existingUnitId != null && review.existingUnitId !== '') {
    const id = creationId(review.existingUnitId);
    if (receipt.kind !== 'unit' || !current.units.some(unit => unit.id === id && unit.projectId === receipt.scopeProjectId)) return denied();
  }
  return receipt;
}
/** Read-only options for the existing administrator conversion screen. */
export async function getEmployeeCreationReviewOptions(db: PrismaClient, reviewerIdentityId: string, applicationId: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM identity WHERE id = ${reviewerIdentityId} FOR SHARE`;
    const reviewer = await tx.identity.findUnique({ where: { id: reviewerIdentityId }, select: { status: true, isAdmin: true } });
    if (!reviewer || reviewer.status !== 'active' || !reviewer.isAdmin) return denied();
    const row = await tx.crmOpportunity.findUnique({ where: { id: creationId(applicationId) }, select: ROW_SELECT });
    if (!row) return missing();
    const receipt = readEmployeeCreationReceipt(row);
    if (!receipt) return missing();
    const current = await access(tx, receipt);
    return {
      units: receipt.kind === 'unit' ? current.units.filter(unit => unit.projectId === receipt.scopeProjectId).map(unit => ({ id: unit.id, name: unit.name, projectId: unit.projectId })) : [],
      projects: receipt.kind === 'complex' ? await tx.project.findMany({ where: { status: { not: 'archived' } }, select: { id: true, name: true, address: true }, orderBy: { name: 'asc' }, take: 500 }) : [],
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
}
/** Exact newly-created DRAFT output only. Matched records have null output
 * receipts and never gain content rights. Used at every proposal access/apply. */
export async function hasEmployeeCreatedTargetAccessTx(tx: Tx, actorId: string, target: { scope: 'unit' | 'project'; id: string; projectId: string }): Promise<boolean> {
  const rows = await tx.crmOpportunity.findMany({ where: { identityId: actorId, source: EMPLOYEE_SUBMISSION_SOURCE,
    requirements: { path: ['employeeCreation', target.scope === 'unit' ? 'createdUnitId' : 'createdProjectId'], equals: target.id } }, select: ROW_SELECT, take: 2 });
  if (rows.length !== 1) return false;
  await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${rows[0].id} FOR SHARE`;
  const row = await tx.crmOpportunity.findUnique({ where: { id: rows[0].id }, select: ROW_SELECT });
  if (!row) return false;
  const receipt = readEmployeeCreationReceipt(row);
  if (!receipt || creationObject(row.requirements).status !== 'converted' || row.projectId !== target.projectId) return false;
  if (target.scope === 'unit') {
    if (receipt.kind !== 'unit' || receipt.createdUnitId !== target.id || receipt.scopeProjectId !== target.projectId) return false;
    await tx.$queryRaw`SELECT id FROM unit WHERE id = ${target.id} FOR SHARE`;
    const unit = await tx.unit.findUnique({ where: { id: target.id }, select: { projectId: true, status: true } });
    if (!unit || unit.status !== 'draft' || unit.projectId !== target.projectId) return false;
  } else {
    if (receipt.kind !== 'complex' || receipt.createdProjectId !== target.id || target.projectId !== target.id) return false;
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${target.id} FOR SHARE`;
    const project = await tx.project.findUnique({ where: { id: target.id }, select: { status: true } });
    if (!project || project.status !== 'draft') return false;
  }
  await access(tx, receipt);
  return true;
}
export async function listEmployeeCreatedTargetsTx(tx: Tx, actorId: string) {
  const rows = await tx.crmOpportunity.findMany({ where: { identityId: actorId, source: EMPLOYEE_SUBMISSION_SOURCE,
    requirements: { path: ['employeeCreation', 'version'], equals: 1 } }, select: ROW_SELECT, take: 500, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] });
  const targets: { scope: 'unit' | 'project'; id: string; projectId: string; name: string; projectName?: string }[] = [];
  for (const row of rows) {
    try {
      const receipt = readEmployeeCreationReceipt(row);
      if (!receipt) continue;
      const id = receipt.createdUnitId ?? receipt.createdProjectId;
      if (!id || !row.projectId) continue;
      const target = { scope: receipt.kind === 'unit' ? 'unit' as const : 'project' as const, id, projectId: row.projectId };
      if (!await hasEmployeeCreatedTargetAccessTx(tx, actorId, target)) continue;
      if (target.scope === 'unit') {
        const record = await tx.unit.findUnique({ where: { id }, select: { name: true, project: { select: { name: true } } } });
        if (record) targets.push({ ...target, name: record.name, projectName: record.project.name });
      } else {
        const record = await tx.project.findUnique({ where: { id }, select: { name: true } });
        if (record) targets.push({ ...target, name: record.name });
      }
    } catch (error) { if (!(error instanceof EmployeeCreationError)) throw error; }
  }
  return targets;
}
export function createEmployeeCreationService(db: PrismaClient) {
  // No automatic retry. Only known request IDs can be explicitly recovered.
  const transaction = <T>(run: (tx: Tx) => Promise<T>) => db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 20000 });
  return {
    async list(actorId: string) {
      return transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM identity WHERE id = ${actorId} FOR SHARE`;
        const actor = await tx.identity.findUnique({ where: { id: actorId }, select: { status: true } });
        if (!actor || actor.status !== 'active') return denied();
        const memberships = await tx.operatingSpaceMember.findMany({ where: { identityId: actorId, active: true,
          capabilities: { hasSome: ['create_unit', 'create_complex'] } }, select: { operatingSpaceId: true }, take: 100 });
        const spaces: { id: string; name: string; organizationId: string; canCreateUnit: boolean; canCreateComplex: boolean; projects: { id: string; name: string }[] }[] = [];
        for (const member of memberships) {
          try { const current = await getEmployeeCreationAccessTx(tx, actorId, member.operatingSpaceId);
            spaces.push({ ...current.space, canCreateUnit: current.canCreateUnit, canCreateComplex: current.canCreateComplex, projects: current.projects });
          } catch (error) { if (!(error instanceof EmployeeCreationError)) throw error; }
        }
        const rows = await tx.crmOpportunity.findMany({ where: { identityId: actorId, source: EMPLOYEE_SUBMISSION_SOURCE,
          requirements: { path: ['employeeCreation', 'version'], equals: 1 } }, select: ROW_SELECT, take: 100, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] });
        const items: ReturnType<typeof detail>[] = [];
        for (const row of rows) {
          try { const receipt = readEmployeeCreationReceipt(row); if (receipt) items.push(await visibleDetail(tx, row, receipt)); }
          catch (error) { if (!(error instanceof EmployeeCreationError)) throw error; }
        }
        return { spaces, items };
      });
    },
    async get(actorId: string, rawId: unknown) {
      const id = creationId(rawId);
      return transaction(async tx => { const { row, receipt } = await owned(tx, actorId, id, false, false); return visibleDetail(tx, row, receipt); });
    },
    async byRequest(actorId: string, rawRequestId: unknown) {
      const requestId = creationRequestId(rawRequestId);
      return transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM identity WHERE id = ${actorId} FOR SHARE`;
        const actor = await tx.identity.findUnique({ where: { id: actorId }, select: { status: true } });
        if (!actor || actor.status !== 'active') return denied();
        const id = await requestRow(tx, actorId, requestId);
        if (!id) return { item: null, requestReceipt: null };
        const { row, receipt } = await owned(tx, actorId, id, false, false), found = receipt.requests.find(entry => entry.requestId === requestId)!;
        return { item: await visibleDetail(tx, row, receipt), requestReceipt: { requestId, revision: found.revision, status: found.status } };
      });
    },
    async duplicates(actorId: string, query: { spaceId: unknown; kind: unknown; projectId: unknown; q: unknown }) {
      const spaceId = creationId(query.spaceId), kind = creationKind(query.kind), projectId = query.projectId ? creationId(query.projectId) : null;
      if (typeof query.q !== 'string' || query.q.trim().length < 2 || query.q.length > 160) throw new EmployeeCreationError(400, 'Enter at least two characters.');
      const q = query.q.trim();
      return transaction(async tx => {
        const current = await getEmployeeCreationAccessTx(tx, actorId, spaceId, kind, projectId);
        const projects = kind === 'complex' ? await tx.project.findMany({ where: { name: { contains: q, mode: 'insensitive' },
          OR: [{ status: 'live' }, { id: { in: current.projects.map(project => project.id) } }] }, select: { id: true, name: true, address: true }, take: 20 }) : [];
        const units = kind === 'unit' ? await tx.unit.findMany({ where: { id: { in: current.units.map(unit => unit.id) }, projectId: projectId!, name: { contains: q, mode: 'insensitive' } },
          select: { id: true, name: true, projectId: true }, take: 20 }) : [];
        return { projects, units };
      });
    },
    async create(actorId: string, body: unknown) {
      const input = parseEmployeeCreationCreate(body), hash = fingerprint(input);
      return transaction(async tx => {
        const current = await getEmployeeCreationAccessTx(tx, actorId, input.spaceId, input.kind, input.projectId);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-creation:${actorId}:${input.requestId}`}, 0))::text`;
        const existing = await requestRow(tx, actorId, input.requestId);
        if (existing) { const { row, receipt } = await owned(tx, actorId, existing);
          if (receipt.requests.find(entry => entry.requestId === input.requestId)?.fingerprint !== hash) return conflict();
          return visibleDetail(tx, row, receipt); }
        await validateDraft(tx, actorId, input.draft, current, input.projectId);
        const id = randomUUID();
        const receipt: EmployeeCreationReceipt = { version: 1, applicationId: id, creatorIdentityId: actorId, spaceId: input.spaceId,
          organizationId: current.space.organizationId, membershipId: current.membershipId, kind: input.kind, scopeProjectId: input.projectId, revision: 1,
          requests: [{ requestId: input.requestId, fingerprint: hash, revision: 1, status: input.status }], createdProjectId: null, createdUnitId: null };
        const row = await tx.crmOpportunity.create({ data: { id, identityId: actorId, source: EMPLOYEE_SUBMISSION_SOURCE, type: 'management', stage: 'new',
          projectId: input.projectId, title: input.draft.unitName || input.draft.proposedProject || 'New property draft',
          requirements: json({ ...input.draft, kind: input.kind === 'unit' ? 'home' : 'resort', status: input.status, employeeCreation: receipt }) }, select: ROW_SELECT });
        await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'employee_creation.created', entityType: 'CrmOpportunity', entityId: id,
          data: json({ spaceId: receipt.spaceId, organizationId: receipt.organizationId, kind: receipt.kind, projectId: receipt.scopeProjectId, revision: 1 }) } });
        return detail(row, receipt);
      });
    },
    async update(actorId: string, body: unknown) {
      const input = parseEmployeeCreationUpdate(body), hash = fingerprint(input);
      return transaction(async tx => {
        const { row, receipt } = await owned(tx, actorId, input.id, true);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-creation:${actorId}:${input.requestId}`}, 0))::text`;
        const request = receipt.requests.find(entry => entry.requestId === input.requestId);
        if (request) { if (request.fingerprint !== hash) return conflict(); return visibleDetail(tx, row, receipt); }
        if (await requestRow(tx, actorId, input.requestId)) return conflict();
        if (receipt.revision !== input.expectedRevision || creationObject(row.requirements).status !== 'draft') return conflict();
        if (receipt.requests.length >= 200) throw new EmployeeCreationError(409, 'This draft has reached its save history limit. Ask an administrator for help or start a new intake.');
        const draft = parseEmployeeCreationDraft(receipt.kind, input.draft, input.status), current = await access(tx, receipt);
        await validateDraft(tx, actorId, draft, current, receipt.scopeProjectId);
        receipt.revision += 1; receipt.requests.push({ requestId: input.requestId, fingerprint: hash, revision: receipt.revision, status: input.status });
        const updated = await tx.crmOpportunity.update({ where: { id: row.id }, data: { title: draft.unitName || draft.proposedProject || 'New property draft',
          requirements: json({ ...draft, kind: receipt.kind === 'unit' ? 'home' : 'resort', status: input.status, employeeCreation: receipt }) }, select: ROW_SELECT });
        await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'employee_creation.saved', entityType: 'CrmOpportunity', entityId: row.id,
          data: json({ revision: receipt.revision, status: input.status }) } });
        return detail(updated, receipt);
      });
    },
  };
}
export function employeeCreationFailure(error: unknown) {
  if (error instanceof EmployeeCreationError) return { status: error.status, error: error.message };
  if (error instanceof SyntaxError) return { status: 400, error: 'Invalid property creation request.' };
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : null;
  const databaseCode = meta && typeof meta === 'object' && 'code' in meta ? meta.code : null;
  if (['P2002', 'P2003', 'P2025', 'P2034', 'P2028'].includes(String(code)) || (code === 'P2010' && ['40001', '40P01', '55P03'].includes(String(databaseCode)))) return { status: 409, error: 'The request changed or its outcome is uncertain. Reload before continuing.' };
  return { status: 500, error: 'Property creation could not be processed.' };
}
