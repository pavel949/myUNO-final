import { createHash } from 'node:crypto';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { parseOwnerEvidence, readOwnerEvidenceStage, type OwnerEvidenceDraft } from './owner-evidence';

type Db = PrismaClient | Prisma.TransactionClient;
function version(projectId: string, draft: OwnerEvidenceDraft) {
  return createHash('sha256').update(JSON.stringify({ projectId, draft })).digest('hex');
}
async function assertAdmin(db: Db, actorIdentityId: string) {
  const actor = await db.identity.findUnique({ where: { id: actorIdentityId }, select: { isAdmin: true, status: true } });
  if (!actor?.isAdmin || actor.status !== 'active') throw new Error('OWNER_EVIDENCE_FORBIDDEN');
}
async function load(db: Db, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error('PROJECT_NOT_FOUND');
  const row = await db.projectOnboardingDraft.findUnique({ where: { project_id: projectId }, select: { stage_data: true } });
  return readOwnerEvidenceStage(row?.stage_data);
}
function dto(projectId: string, draft: OwnerEvidenceDraft) { return { projectId, version: version(projectId, draft), draft }; }
export async function readOwnerEvidenceDraft(db: Db, projectId: string, actorIdentityId: string) {
  await assertAdmin(db, actorIdentityId);
  return dto(projectId, (await load(db, projectId)).draft);
}
/** Saves private intake; deliberately no approval, title, identity or authority command. */
export async function saveOwnerEvidenceDraft(db: PrismaClient, input: {
  projectId: string; actorIdentityId: string; expectedVersion: string; evidence: unknown;
}) {
  if (typeof input.expectedVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedVersion)) {
    throw new Error('OWNER_EVIDENCE_VERSION_REQUIRED');
  }
  const evidence = parseOwnerEvidence(input.evidence);
  return db.$transaction(async tx => {
    await assertAdmin(tx, input.actorIdentityId);
    // Project-only lock: never acquire unit/finance locks after this lock.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { stages, draft } = await load(tx, input.projectId);
    // Exact same-content retry is a no-op, including an uncertain previously accepted save.
    if (JSON.stringify(evidence) === JSON.stringify(draft.evidence)) return dto(input.projectId, draft);
    if (version(input.projectId, draft) !== input.expectedVersion) throw new Error('OWNER_EVIDENCE_CONFLICT');
    if (!Number.isSafeInteger(draft.revision + 1)) throw new Error('OWNER_EVIDENCE_INVALID');
    const next: OwnerEvidenceDraft = { schemaVersion: 1, revision: draft.revision + 1, evidence,
      executionStatus: 'unverified', ownershipStatus: 'unverified', licenceStatus: 'unverified' };
    const now = new Date();
    const stageData = { ...stages, ownerContractEvidence: next } as Prisma.InputJsonValue;
    await tx.projectOnboardingDraft.upsert({ where: { project_id: input.projectId },
      create: { project_id: input.projectId, stage_data: stageData, updated_by_identity_id: input.actorIdentityId },
      update: { stage_data: stageData, updated_by_identity_id: input.actorIdentityId, updated_at: now, autosaved_at: now },
    });
    const result = dto(input.projectId, next);
    await tx.auditLog.create({ data: { actorIdentityId: input.actorIdentityId,
      action: 'projects:owner_evidence_draft_saved', entityType: 'Project', entityId: input.projectId,
      data: { beforeVersion: input.expectedVersion, afterVersion: result.version, revision: next.revision },
    } });
    return result;
  });
}
