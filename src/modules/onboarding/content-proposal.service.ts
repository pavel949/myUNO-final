import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  ContentProposalValidationError, parseContentProposal, parseScope, parseTargetId,
  type ContentFacts, type ContentLocale, type ContentProposal, type ContentScope,
} from './content-proposal.schema';

export const CONTENT_PROPOSAL_SOURCE = 'myuno_property_content_proposal_v1';
const MAX_ITEMS = 100;
const MAX_TARGETS = 500;
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
type Tx = Prisma.TransactionClient;
type ProposalStatus = 'draft' | 'submitted' | 'returned' | 'approved';
export type ContentTarget = { scope: ContentScope; id: string; projectId: string; name: string; projectName?: string };
export type ContentSnapshot = {
  facts: ContentFacts;
  descriptionKey: string | null;
  descriptions: Partial<Record<ContentLocale, string>>;
  gallery: { mediaIds: string[]; coverMediaId: string | null; media: { id: string; url: string }[] };
};
type StoredProposal = {
  version: 1; scope: ContentScope; targetId: string; projectId: string;
  status: ProposalStatus; revision: number; baselineVersion: string;
  baseline: ContentSnapshot; proposal: ContentProposal; reviewNote: string | null;
  approvedFromRevision: number | null;
};
const ROW_SELECT = {
  id: true, identityId: true, source: true, projectId: true, unitId: true,
  requirements: true, updatedAt: true,
} as const;
type Row = Prisma.CrmOpportunityGetPayload<{ select: typeof ROW_SELECT }>;

export class ContentProposalError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message); this.name = 'ContentProposalError';
  }
}
const fail = (status: ContentProposalError['status'], message: string): never => { throw new ContentProposalError(status, message); };
const invalid = (): never => fail(400, 'Invalid content proposal request.');
const conflict = (): never => fail(409, 'This proposal or property changed. Reload it before continuing.');

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return invalid();
  return value as Record<string, unknown>;
}
function exact(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  const data = object(value);
  if (required.some(key => !Object.prototype.hasOwnProperty.call(data, key)) ||
      Object.keys(data).some(key => !required.includes(key) && !optional.includes(key))) return invalid();
  return data;
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalid();
  return value;
}
function draftStatus(value: unknown): 'draft' | 'submitted' {
  if (value !== 'draft' && value !== 'submitted') return invalid();
  return value;
}
function version(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return invalid();
  return value;
}
function note(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > 2000) return invalid();
  return value.trim() || null;
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    return `{${Object.keys(data).sort().map(key => `${JSON.stringify(key)}:${stable(data[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

/** Session flags and cached roles are not authority; check the live identity. */
async function activeIdentity(tx: Tx, id: string, admin = false) {
  await tx.$queryRaw`SELECT id FROM identity WHERE id = ${id} FOR SHARE`;
  const actor = await tx.identity.findUnique({ where: { id }, select: { id: true, status: true, isAdmin: true } });
  if (!actor || actor.status !== 'active' || (admin && !actor.isAdmin)) return fail(403, 'Forbidden.');
  return actor;
}

/** Exact grants deliberately do not inherit from project to child unit. */
async function contributor(tx: Tx, authorId: string, target: ContentTarget): Promise<void> {
  await activeIdentity(tx, authorId);
  const unitId = target.scope === 'unit' ? target.id : null;
  // Locks protect approval against concurrent revocation or scope edits.
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM role_assignment
    WHERE identity_id = ${authorId} AND role::text = 'content_contributor'
      AND status::text = 'active' AND scope_type::text = ${target.scope}
      AND project_id = ${target.projectId} AND unit_id IS NOT DISTINCT FROM ${unitId}
      AND organization_id IS NULL AND provider_id IS NULL FOR SHARE`;
  if (locked.length === 0) return fail(403, 'This content target is not assigned to you.');
}

async function assignedTarget(tx: Tx, authorId: string, scope: ContentScope, id: string) {
  const unit = scope === 'unit' ? await tx.unit.findUnique({ where: { id }, select: { id: true, projectId: true } }) : null;
  const project = scope === 'project' ? await tx.project.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!unit && !project) return fail(404, 'Content target not found.');
  await contributor(tx, authorId, { scope, id, projectId: unit?.projectId ?? id, name: '' });
}

const UNIT_SELECT = {
  id: true, projectId: true, updatedAt: true, name: true, bedrooms: true, bathrooms: true,
  maxGuests: true, sizeSqm: true, grossAreaSqm: true, floor: true, addressSupplement: true, amenityKeys: true,
  descriptionKey: true, marketingTitleKey: true, coverMediaId: true, project: { select: { name: true } },
} as const;
const PROJECT_SELECT = {
  id: true, updatedAt: true, name: true, brand: true, address: true, city: true, district: true,
  projectType: true, totalUnits: true, descriptionKey: true, coverMediaId: true,
} as const;
const MEDIA_SELECT = { id: true, storageKey: true, kind: true, encrypted: true, sizeBytes: true, mimeType: true,
  uploadedByIdentityId: true, updatedAt: true, deleteAfter: true } as const;
type Asset = Prisma.MediaAssetGetPayload<{ select: typeof MEDIA_SELECT }>;
function publicPhoto(asset: Asset): boolean {
  return asset.kind === 'photo' && !asset.encrypted && asset.sizeBytes > 0 && PHOTO_MIMES.includes(asset.mimeType) &&
    asset.deleteAfter === null && /^(https?:\/\/|\/[^/])/.test(asset.storageKey);
}

const CONTENT_SELECT = {
  id: true, key: true, namespace: true, description: true, supportsRich: true, createdAt: true, updatedAt: true,
  translations: { orderBy: { locale: 'asc' as const }, select: { id: true, locale: true, value: true, status: true,
    createdAt: true, updatedAt: true, updatedByIdentityId: true } },
} as const;

async function canonical(tx: Tx, scope: ContentScope, id: string) {
  // Parent FOR UPDATE blocks new child FK links. Existing child locks block
  // unlink/reorder, including writers that do not explicitly lock the parent.
  if (scope === 'unit') {
    await tx.$queryRaw`SELECT id FROM unit WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT media_id FROM unit_media WHERE unit_id = ${id} ORDER BY media_id FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT media_id FROM project_media WHERE project_id = ${id} ORDER BY media_id FOR UPDATE`;
  }
  const unit = scope === 'unit' ? await tx.unit.findUnique({ where: { id }, select: UNIT_SELECT }) : null;
  const project = scope === 'project' ? await tx.project.findUnique({ where: { id }, select: PROJECT_SELECT }) : null;
  if (!unit && !project) return fail(404, 'Content target not found.');
  const target: ContentTarget = unit
    ? { scope, id, projectId: unit.projectId, name: unit.name, projectName: unit.project.name }
    : { scope, id, projectId: project!.id, name: project!.name };
  const facts: ContentFacts = unit ? {
    name: unit.name, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, maxGuests: unit.maxGuests,
    sizeSqm: unit.sizeSqm, grossAreaSqm: unit.grossAreaSqm === null ? null : Number(unit.grossAreaSqm), floor: unit.floor, addressSupplement: unit.addressSupplement, amenityKeys: unit.amenityKeys,
  } : {
    name: project!.name, brand: project!.brand, address: project!.address, city: project!.city,
    district: project!.district, projectType: project!.projectType as ContentProposal<'project'>['facts']['projectType'],
    totalUnits: project!.totalUnits,
  };
  const row = unit ?? project!;
  const descriptionKey = row.descriptionKey || null;
  // Explicit title pointers survive description copy-on-write. Legacy units
  // resolve the derived key until approval pins that original name, even when
  // the title row does not exist yet. No missing-row/gap lock is required.
  const marketingTitleKey = unit?.marketingTitleKey ?? null;
  const pairedTitleKey = unit ? marketingTitleKey ?? (descriptionKey
    ? descriptionKey.replace(/\.description$/, '.title') : null) : null;
  const contentNames = [...new Set([descriptionKey, pairedTitleKey].filter((name): name is string => Boolean(name)))].sort();
  for (const name of contentNames) {
    // Parent lock prevents a concurrent new locale; translation locks prevent edits.
    await tx.$queryRaw`SELECT id FROM content_key WHERE key = ${name} FOR UPDATE`;
    await tx.$queryRaw`SELECT t.id FROM translation t JOIN content_key k ON k.id = t.content_key_id
      WHERE k.key = ${name} ORDER BY t.id FOR UPDATE OF t`;
  }
  const key = descriptionKey ? await tx.contentKey.findUnique({ where: { key: descriptionKey }, select: CONTENT_SELECT }) : null;
  const titleKey = pairedTitleKey === descriptionKey ? key : pairedTitleKey
    ? await tx.contentKey.findUnique({ where: { key: pairedTitleKey }, select: CONTENT_SELECT }) : null;
  const links = unit
    ? await tx.unitMedia.findMany({ where: { unitId: id }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }], select: { mediaId: true, sort: true }, take: 201 })
    : await tx.projectMedia.findMany({ where: { projectId: id }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }], select: { mediaId: true, sort: true }, take: 201 });
  if (links.length > 200) return fail(409, 'This gallery needs administrator cleanup before editing.');
  const assets = links.length ? await tx.mediaAsset.findMany({ where: { id: { in: links.map(link => link.mediaId) } }, select: MEDIA_SELECT }) : [];
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  const descriptions: ContentSnapshot['descriptions'] = {};
  for (const translation of key?.translations ?? []) {
    if (['ru', 'en', 'th', 'zh'].includes(translation.locale)) descriptions[translation.locale as ContentLocale] = translation.value;
  }
  const snapshot: ContentSnapshot = {
    facts, descriptionKey, descriptions,
    gallery: { mediaIds: links.map(link => link.mediaId), coverMediaId: row.coverMediaId,
      media: links.flatMap(link => { const asset = byId.get(link.mediaId); return asset && publicPhoto(asset) ? [{ id: asset.id, url: asset.storageKey }] : []; }) },
  };
  // Do not persist an unreadable draft for legacy facts or a dangling cover.
  // Cleanup is an explicit administrator job, never an implicit content edit.
  try {
    parseContentProposal(scope, { facts, description: null,
      gallery: { mediaIds: snapshot.gallery.mediaIds, coverMediaId: snapshot.gallery.coverMediaId } });
  } catch {
    return fail(409, 'This property has legacy facts or gallery links that need administrator cleanup before editing.');
  }
  // Include all locale content/revisions, exact gallery sort values, and the
  // canonical row revision. Never hash client snapshots or only changed fields.
  const baselineVersion = fingerprint(json({ scope, id, projectId: target.projectId, snapshot,
    updatedAt: row.updatedAt, content: key, marketingTitleKey, pairedTitleKey, titleContent: titleKey, gallery: links }));
  return { target, snapshot, baselineVersion, key, marketingTitleKey, pairedTitleKey, updatedAt: row.updatedAt };
}

async function validateMedia(tx: Tx, authorId: string, proposal: ContentProposal, current: ContentSnapshot) {
  const ids = proposal.gallery.mediaIds;
  // Lock asset metadata as well as relations: private/deleted media cannot race approval.
  for (const id of [...ids].sort()) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM media_asset WHERE id = ${id} FOR SHARE`;
    if (locked.length !== 1) return fail(403, 'Use current gallery photos or public photos you uploaded.');
  }
  const assets = ids.length ? await tx.mediaAsset.findMany({ where: { id: { in: ids } }, select: MEDIA_SELECT }) : [];
  if (assets.length !== ids.length || assets.some(asset => !publicPhoto(asset) ||
      (!current.gallery.mediaIds.includes(asset.id) && asset.uploadedByIdentityId !== authorId))) {
    return fail(403, 'Use current gallery photos or public photos you uploaded.');
  }
}

function stored(row: Row): StoredProposal {
  try {
    const value = exact(row.requirements, ['version', 'scope', 'targetId', 'projectId', 'status', 'revision',
      'baselineVersion', 'baseline', 'proposal', 'reviewNote', 'approvedFromRevision']);
    if (value.version !== 1 || !['draft', 'submitted', 'returned', 'approved'].includes(String(value.status))) return conflict();
    const scope = parseScope(value.scope), targetId = parseTargetId(value.targetId), projectId = parseTargetId(value.projectId);
    if (row.source !== CONTENT_PROPOSAL_SOURCE || row.projectId !== projectId ||
        (scope === 'unit' ? row.unitId !== targetId : row.unitId !== null || projectId !== targetId)) return conflict();
    const baseline = object(value.baseline);
    exact(baseline, ['facts', 'descriptionKey', 'descriptions', 'gallery']);
    // Baseline is a server snapshot; it is never spread into canonical writes.
    if (baseline.descriptionKey !== null && typeof baseline.descriptionKey !== 'string') return conflict();
    const descriptions = object(baseline.descriptions);
    if (Object.entries(descriptions).some(([key, val]) => !['ru','en','th','zh'].includes(key) || typeof val !== 'string')) return conflict();
    const gallery = exact(baseline.gallery, ['mediaIds', 'coverMediaId', 'media']);
    if (!Array.isArray(gallery.media) || gallery.media.some(item => {
      const media = exact(item, ['id', 'url']); return typeof media.id !== 'string' || typeof media.url !== 'string';
    })) return conflict();
    // Validate facts and gallery bounds without accepting the snapshot as authority.
    parseContentProposal(scope, { facts: baseline.facts, description: null,
      gallery: { mediaIds: gallery.mediaIds, coverMediaId: gallery.coverMediaId } });
    return { version: 1, scope, targetId, projectId, status: value.status as ProposalStatus,
      revision: revision(value.revision), baselineVersion: version(value.baselineVersion),
      baseline: baseline as ContentSnapshot, proposal: parseContentProposal(scope, value.proposal),
      reviewNote: note(value.reviewNote), approvedFromRevision: value.approvedFromRevision === null ? null : revision(value.approvedFromRevision) };
  } catch { return fail(409, 'Stored proposal needs administrator repair.'); }
}
function detail(row: Row, data: StoredProposal) {
  return { id: row.id, scope: data.scope, targetId: data.targetId, projectId: data.projectId,
    status: data.status, revision: data.revision, baselineVersion: data.baselineVersion,
    baseline: data.baseline, proposal: data.proposal, reviewNote: data.reviewNote };
}
async function proposalRow(tx: Tx, id: string, lock = false): Promise<Row> {
  parseTargetId(id);
  if (lock) await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${id} FOR UPDATE`;
  const row = await tx.crmOpportunity.findUnique({ where: { id }, select: ROW_SELECT });
  if (!row || row.source !== CONTENT_PROPOSAL_SOURCE) return fail(404, 'Proposal not found.');
  return row;
}
function targetOf(data: StoredProposal): ContentTarget {
  return { scope: data.scope, id: data.targetId, projectId: data.projectId, name: data.baseline.facts.name };
}

/** Injectable DB keeps routes and real PostgreSQL integration tests on one implementation. */
export function createContentProposalService(db: PrismaClient) {
  const transaction = <T>(run: (tx: Tx) => Promise<T>) => db.$transaction(run, { maxWait: 5000, timeout: 15000 });
  return {
    async list(actorId: string) {
      return transaction(async tx => {
        const actor = await activeIdentity(tx, actorId);
        const grants = actor.isAdmin ? [] : await tx.roleAssignment.findMany({
          where: { identityId: actorId, role: 'content_contributor', status: 'active', organizationId: null, providerId: null,
            OR: [{ scopeType: 'project', unitId: null, projectId: { not: null } }, { scopeType: 'unit', unitId: { not: null }, projectId: { not: null } }] },
          select: { scopeType: true, projectId: true, unitId: true }, take: MAX_TARGETS,
        });
        const [units, projects] = await Promise.all([
          tx.unit.findMany({ where: { OR: grants.filter(g => g.scopeType === 'unit').map(g => ({ id: g.unitId!, projectId: g.projectId! })) },
            select: { id: true, name: true, projectId: true, project: { select: { name: true } } }, orderBy: { name: 'asc' }, take: MAX_TARGETS }),
          tx.project.findMany({ where: { id: { in: grants.filter(g => g.scopeType === 'project').map(g => g.projectId!) } },
            select: { id: true, name: true }, orderBy: { name: 'asc' }, take: MAX_TARGETS }),
        ]);
        const targets: ContentTarget[] = [...units.map(unit => ({ scope: 'unit' as const, id: unit.id, name: unit.name, projectId: unit.projectId, projectName: unit.project.name })),
          ...projects.map(project => ({ scope: 'project' as const, id: project.id, name: project.name, projectId: project.id }))].slice(0, MAX_TARGETS);
        const rows = await tx.crmOpportunity.findMany({ where: { source: CONTENT_PROPOSAL_SOURCE,
          ...(!actor.isAdmin ? { identityId: actorId, OR: targets.map(target => ({ projectId: target.projectId, unitId: target.scope === 'unit' ? target.id : null })) } : {}) },
          select: ROW_SELECT, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: MAX_ITEMS });
        const items = rows.flatMap(row => {
          try { const data = stored(row);
            if (!actor.isAdmin && !targets.some(target => target.scope === data.scope && target.id === data.targetId && target.projectId === data.projectId)) return [];
            return [{ id: row.id, scope: data.scope, targetId: data.targetId, projectId: data.projectId,
              targetName: data.baseline.facts.name, status: data.status, revision: data.revision, updatedAt: row.updatedAt, reviewNote: data.reviewNote }];
          } catch { return []; }
        });
        return { targets, items };
      });
    },
    async target(actorId: string, rawScope: unknown, rawId: unknown) {
      const scope = parseScope(rawScope), id = parseTargetId(rawId);
      return transaction(async tx => {
        await activeIdentity(tx, actorId);
        await assignedTarget(tx, actorId, scope, id);
        const current = await canonical(tx, scope, id);
        await contributor(tx, actorId, current.target);
        return { target: current.target, snapshot: current.snapshot, baselineVersion: current.baselineVersion };
      });
    },
    async get(actorId: string, id: string) {
      return transaction(async tx => {
        const actor = await activeIdentity(tx, actorId);
        const row = await proposalRow(tx, id);
        if (!actor.isAdmin && row.identityId !== actorId) return fail(404, 'Proposal not found.');
        const data = stored(row);
        if (!actor.isAdmin) {
          const bound = data.scope === 'unit'
            ? await tx.unit.findFirst({ where: { id: data.targetId, projectId: data.projectId }, select: { id: true } })
            : await tx.project.findUnique({ where: { id: data.targetId }, select: { id: true } });
          if (!bound) return fail(404, 'Content target not found.');
          await contributor(tx, actorId, targetOf(data));
        }
        const links = data.scope === 'unit'
          ? await tx.unitMedia.findMany({ where: { unitId: data.targetId }, select: { mediaId: true } })
          : await tx.projectMedia.findMany({ where: { projectId: data.targetId }, select: { mediaId: true } });
        const assets = data.proposal.gallery.mediaIds.length ? await tx.mediaAsset.findMany({
          where: { id: { in: data.proposal.gallery.mediaIds } }, select: MEDIA_SELECT,
        }) : [];
        const media = assets.filter(asset => publicPhoto(asset) && (asset.uploadedByIdentityId === row.identityId ||
          links.some(link => link.mediaId === asset.id))).map(asset => ({ id: asset.id, url: asset.storageKey }));
        const author = actor.isAdmin ? await tx.identity.findUnique({ where: { id: row.identityId },
          select: { id: true, firstName: true, lastName: true } }) : null;
        return { ...detail(row, data), media, ...(author ? { author: {
          id: author.id, name: [author.firstName, author.lastName].filter(Boolean).join(' ') || author.id,
        } } : {}) };
      });
    },
    async create(actorId: string, body: unknown) {
      const input = exact(body, ['scope', 'targetId', 'baselineVersion', 'proposal', 'status']);
      const scope = parseScope(input.scope), id = parseTargetId(input.targetId);
      const proposal = parseContentProposal(scope, input.proposal), status = draftStatus(input.status);
      const baselineVersion = version(input.baselineVersion);
      return transaction(async tx => {
        await activeIdentity(tx, actorId);
        await assignedTarget(tx, actorId, scope, id);
        const current = await canonical(tx, scope, id);
        await contributor(tx, actorId, current.target);
        if (current.baselineVersion !== baselineVersion) return conflict();
        await validateMedia(tx, actorId, proposal, current.snapshot);
        const data: StoredProposal = { version: 1, scope, targetId: id, projectId: current.target.projectId,
          status, revision: 1, baselineVersion, baseline: current.snapshot, proposal, reviewNote: null, approvedFromRevision: null };
        const row = await tx.crmOpportunity.create({ data: {
          identityId: actorId, projectId: data.projectId, unitId: scope === 'unit' ? id : null,
          type: 'management', stage: 'new', title: `Content proposal: ${current.target.name}`,
          source: CONTENT_PROPOSAL_SOURCE, requirements: json(data),
        }, select: ROW_SELECT });
        return detail(row, data);
      });
    },
    async update(actorId: string, id: string, body: unknown) {
      const raw = object(body), rebase = raw.action === 'rebase';
      const input = exact(body, rebase ? ['expectedRevision', 'action'] : ['expectedRevision', 'proposal', 'status']);
      const expectedRevision = revision(input.expectedRevision);
      return transaction(async tx => {
        await activeIdentity(tx, actorId);
        const row = await proposalRow(tx, id, true);
        if (row.identityId !== actorId) return fail(404, 'Proposal not found.');
        const data = stored(row);
        if (data.revision !== expectedRevision) return conflict();
        if (!['draft', 'returned'].includes(data.status)) return fail(409, 'Only draft or returned proposals can be edited.');
        await assignedTarget(tx, actorId, data.scope, data.targetId);
        const current = await canonical(tx, data.scope, data.targetId);
        if (current.target.projectId !== data.projectId) return conflict();
        await contributor(tx, actorId, current.target);
        let proposal: ContentProposal;
        if (rebase) {
          proposal = parseContentProposal(data.scope, { facts: current.snapshot.facts, description: null,
            gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } });
          data.baseline = current.snapshot; data.baselineVersion = current.baselineVersion; data.status = 'draft';
        } else {
          if (current.baselineVersion !== data.baselineVersion) return conflict();
          proposal = parseContentProposal(data.scope, input.proposal); data.status = draftStatus(input.status);
        }
        await validateMedia(tx, actorId, proposal, current.snapshot);
        data.proposal = proposal; data.revision += 1;
        const updated = await tx.crmOpportunity.update({ where: { id }, data: { requirements: json(data) }, select: ROW_SELECT });
        return detail(updated, data);
      });
    },
    async review(actorId: string, id: string, body: unknown) {
      const input = exact(body, ['action', 'expectedRevision'], ['note']);
      if (input.action !== 'approve' && input.action !== 'return') return invalid();
      const expectedRevision = revision(input.expectedRevision), reviewNote = note(input.note);
      if (input.action === 'return' && !reviewNote) return fail(400, 'Explain what needs to change before returning this proposal.');
      return transaction(async tx => {
        await activeIdentity(tx, actorId, true);
        const row = await proposalRow(tx, id, true), data = stored(row);
        if (data.status === 'approved' && input.action === 'approve') {
          if (expectedRevision !== data.revision && expectedRevision !== data.approvedFromRevision) return conflict();
          return { ...detail(row, data), alreadyApproved: true };
        }
        if (data.revision !== expectedRevision) return conflict();
        if (data.status !== 'submitted') return fail(409, 'Only submitted proposals can be reviewed.');
        if (input.action === 'return') {
          data.status = 'returned'; data.reviewNote = reviewNote; data.revision += 1;
          const returned = await tx.crmOpportunity.update({ where: { id }, data: { requirements: json(data) }, select: ROW_SELECT });
          await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'property_content_proposal.returned', entityType: 'CrmOpportunity', entityId: id,
            data: json({ scope: data.scope, targetId: data.targetId, revision: data.revision }) } });
          return detail(returned, data);
        }
        const current = await canonical(tx, data.scope, data.targetId);
        if (current.target.projectId !== data.projectId || current.baselineVersion !== data.baselineVersion) return conflict();
        await contributor(tx, row.identityId, current.target);
        const proposal = parseContentProposal(data.scope, data.proposal);
        await validateMedia(tx, row.identityId, proposal, current.snapshot);
        let descriptionKey = current.snapshot.descriptionKey;
        if (proposal.description) {
          if (descriptionKey) {
            const [units, projects, areas] = await Promise.all([
              tx.unit.count({ where: { descriptionKey } }), tx.project.count({ where: { descriptionKey } }), tx.area.count({ where: { descriptionKey } }),
            ]);
            if ((current.key && (current.key.namespace !== data.scope || current.key.supportsRich)) ||
                units !== (data.scope === 'unit' ? 1 : 0) || projects !== (data.scope === 'project' ? 1 : 0) || areas !== 0) {
              return fail(409, 'This description is shared or incompatible. An administrator must repair its content key first.');
            }
          }
          // Always copy-on-write. Plain content-key strings can be reused by
          // unrelated surfaces (including non-description fields) without an FK.
          // A new immutable key avoids clobbering those aliases or racing aliases.
          descriptionKey = `${data.scope}.${data.targetId}.proposal.${id}.description`;
          const key = await tx.contentKey.create({ data: { key: descriptionKey, namespace: data.scope,
            description: 'Property description from an approved content proposal', supportsRich: false }, select: { id: true } });
          for (const previous of current.key?.translations ?? []) {
            if (previous.locale === proposal.description.locale) continue;
            await tx.translation.create({ data: { contentKeyId: key.id, locale: previous.locale,
              value: previous.value, status: previous.status, updatedByIdentityId: previous.updatedByIdentityId,
              createdAt: previous.createdAt, updatedAt: previous.updatedAt } });
          }
          await tx.translation.create({ data: { contentKeyId: key.id, locale: proposal.description.locale,
            value: proposal.description.value, status: 'needs_review', updatedByIdentityId: actorId } });

        }
        // Explicit fact projections only. No unparsed request or CRM JSON spread.
        if (data.scope === 'unit') {
          const facts = parseContentProposal('unit', proposal).facts;
          await tx.unit.update({ where: { id: data.targetId }, data: {
            name: facts.name, bedrooms: facts.bedrooms, bathrooms: facts.bathrooms, maxGuests: facts.maxGuests,
            sizeSqm: facts.sizeSqm, grossAreaSqm: facts.grossAreaSqm, floor: facts.floor, addressSupplement: facts.addressSupplement, amenityKeys: facts.amenityKeys,
            coverMediaId: proposal.gallery.coverMediaId, ...(proposal.description ? { descriptionKey } : {}),
            ...(proposal.description && current.marketingTitleKey === null && current.pairedTitleKey !== null
              ? { marketingTitleKey: current.pairedTitleKey } : {}),
            // Always advance canonical revision, including description/gallery-only changes.
            updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          } });
          await tx.unitMedia.deleteMany({ where: { unitId: data.targetId, mediaId: { notIn: proposal.gallery.mediaIds } } });
          for (const [sort, mediaId] of proposal.gallery.mediaIds.entries()) await tx.unitMedia.upsert({
            where: { unitId_mediaId: { unitId: data.targetId, mediaId } },
            create: { unitId: data.targetId, mediaId, sort }, update: { sort },
          });
        } else {
          const facts = parseContentProposal('project', proposal).facts;
          await tx.project.update({ where: { id: data.targetId }, data: {
            name: facts.name, brand: facts.brand, address: facts.address, city: facts.city, district: facts.district,
            projectType: facts.projectType, totalUnits: facts.totalUnits,
            coverMediaId: proposal.gallery.coverMediaId, ...(proposal.description ? { descriptionKey: descriptionKey! } : {}), updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          } });
          await tx.projectMedia.deleteMany({ where: { projectId: data.targetId, mediaId: { notIn: proposal.gallery.mediaIds } } });
          for (const [sort, mediaId] of proposal.gallery.mediaIds.entries()) await tx.projectMedia.upsert({
            where: { projectId_mediaId: { projectId: data.targetId, mediaId } },
            create: { projectId: data.targetId, mediaId, sort }, update: { sort },
          });
        }
        data.status = 'approved'; data.approvedFromRevision = data.revision; data.revision += 1; data.reviewNote = reviewNote;
        const approved = await tx.crmOpportunity.update({ where: { id }, data: { requirements: json(data) }, select: ROW_SELECT });
        await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'property_content_proposal.approved', entityType: 'CrmOpportunity', entityId: id,
          data: json({ authorIdentityId: row.identityId, scope: data.scope, targetId: data.targetId,
            baselineVersion: data.baselineVersion, revision: data.revision, descriptionLocale: proposal.description?.locale ?? null }) } });
        return { ...detail(approved, data), alreadyApproved: false };
      });
    },
  };
}

/** Fixed, public errors only. Raw Prisma errors can contain user data or SQL. */
export function contentProposalFailure(error: unknown): { status: number; error: string } {
  if (error instanceof ContentProposalError) return { status: error.status, error: error.message };
  if (error instanceof ContentProposalValidationError || error instanceof SyntaxError) return { status: 400, error: 'Invalid content proposal request.' };
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : null;
  const databaseCode = meta && typeof meta === 'object' && 'code' in meta ? meta.code : null;
  if (['P2002', 'P2003', 'P2025', 'P2034', 'P2028'].includes(String(code)) || ['40P01', '40001', '55P03'].includes(String(databaseCode))) return { status: 409, error: 'This proposal or property changed. Reload it before continuing.' };
  return { status: 500, error: 'Content proposal could not be processed.' };
}
