import type { Prisma, PrismaClient } from '@prisma/client';
import { eligibleOrganizationUnits, getLegacyOperationalUnitIds, getOperationalActor, OperatingAccessError, validOperatingCapabilities } from './operating-space-access.service';
import { CAPABILITY_DEPARTMENTS, GOVERNED_DAILY_CAPABILITIES } from './operating-space-capabilities';

type Db = PrismaClient | Prisma.TransactionClient;


export async function requireGovernanceFounder(db: Db, identityId: string) {
  const actor = await getOperationalActor(db, identityId);
  if (!actor.isAdmin) throw new OperatingAccessError('Founder access required');
  return actor;
}


function uniqueUnitIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000 || value.some(id => typeof id !== 'string' || !id || id.length > 100)) {
    throw new OperatingAccessError('Choose up to 1000 canonical units', 400);
  }
  if (new Set(value).size !== value.length) throw new OperatingAccessError('Duplicate units are not allowed', 400);
  return value;
}

async function lockSpaceVersion(tx: Prisma.TransactionClient, spaceId: string, expectedUpdatedAt: string) {
  const expected = new Date(expectedUpdatedAt);
  if (!expectedUpdatedAt || Number.isNaN(expected.getTime())) throw new OperatingAccessError('Refresh this space before saving', 409);
  const space = await tx.operatingSpace.findUnique({ where: { id: spaceId } });
  if (!space || space.status !== 'active') throw new OperatingAccessError('Operating space is not active', 404);
  const changed = await tx.operatingSpace.updateMany({ where: { id: spaceId, updatedAt: expected, status: 'active' },
    data: { updatedAt: new Date(Math.max(Date.now(), expected.getTime() + 1)) } });
  if (changed.count !== 1) throw new OperatingAccessError('This space changed. Refresh and review before saving.', 409);
  return space;
}

async function saveScope(tx: Prisma.TransactionClient, actorId: string, spaceId: string, organizationId: string, unitIds: string[]) {
  // Serialize overlapping selections across different spaces without a new occupancy store.
  for (const id of [...unitIds].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`operating-space-unit:${id}`}))`;
  }
  const now = new Date();
  const eligible = new Set((await eligibleOrganizationUnits(tx, organizationId, now)).map(u => u.id));
  if (unitIds.some(id => !eligible.has(id))) throw new OperatingAccessError('A unit lacks a current verified operating relationship with this organization', 400);
  const conflicts = await tx.operatingSpaceUnit.findMany({ where: {
    unitId: { in: unitIds }, active: true, OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    operatingSpace: { status: 'active', organizationId: { not: organizationId } },
  }, select: { unitId: true } });
  if (conflicts.length) throw new OperatingAccessError('A selected unit is attached to another active organization. Resolve that operating scope first.', 409);
  const before = await tx.operatingSpaceUnit.findMany({ where: { operatingSpaceId: spaceId }, select: { unitId: true, active: true, startsOn: true, endsOn: true } });
  if (before.some(u => u.active && u.startsOn > now)) throw new OperatingAccessError('This scope contains future attachments. Review their operating dates before changing scope.', 409);
  await tx.operatingSpaceUnit.updateMany({ where: { operatingSpaceId: spaceId, active: true, unitId: { notIn: unitIds } }, data: { active: false, endsOn: now } });
  for (const unitId of unitIds) {
    const existing = before.find(u => u.unitId === unitId);
    // Never silently alter a scheduled attachment. An explicit future scheduling UI is separate.
    if (existing?.active && (existing.startsOn > now || (existing.endsOn && existing.endsOn <= now))) {
      throw new OperatingAccessError('A selected attachment has scheduled dates. Review its operating dates before changing scope.', 409);
    }
    await tx.operatingSpaceUnit.upsert({ where: { operatingSpaceId_unitId: { operatingSpaceId: spaceId, unitId } },
      create: { operatingSpaceId: spaceId, unitId, active: true, startsOn: now },
      update: existing?.active ? {} : { active: true, startsOn: now, endsOn: null },
    });
  }
  await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'operating_space:scope', entityType: 'OperatingSpace', entityId: spaceId,
    data: { before: before.map(u => ({ ...u, startsOn: u.startsOn.toISOString(), endsOn: u.endsOn?.toISOString() ?? null })), afterUnitIds: unitIds },
  } });
}

export async function createGovernedOperatingSpace(db: PrismaClient, actorId: string, input: {
  organizationId: string; key: string; name: string; unitIds: unknown;
}) {
  const key = input.key?.trim(); const name = input.name?.trim(); const unitIds = uniqueUnitIds(input.unitIds);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(key || '') || !name || name.length > 120 || !unitIds.length) {
    throw new OperatingAccessError('Enter a 3–64 character key, a name, and at least one eligible unit', 400);
  }
  return db.$transaction(async tx => {
    await requireGovernanceFounder(tx, actorId);
    await eligibleOrganizationUnits(tx, input.organizationId);
    const space = await tx.operatingSpace.create({ data: { key, name, organizationId: input.organizationId } });
    await saveScope(tx, actorId, space.id, input.organizationId, unitIds);
    await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'operating_space:create', entityType: 'OperatingSpace', entityId: space.id,
      data: { organizationId: input.organizationId, key, unitIds },
    } });
    return space;
  });
}

export async function updateGovernedOperatingScope(db: PrismaClient, actorId: string, spaceId: string, input: { unitIds: unknown; expectedUpdatedAt: string }) {
  const unitIds = uniqueUnitIds(input.unitIds);
  return db.$transaction(async tx => {
    await requireGovernanceFounder(tx, actorId);
    const space = await lockSpaceVersion(tx, spaceId, input.expectedUpdatedAt);
    await saveScope(tx, actorId, spaceId, space.organizationId, unitIds);
    return tx.operatingSpace.findUniqueOrThrow({ where: { id: spaceId }, select: { id: true, updatedAt: true } });
  });
}

export async function updateGovernedOperatingMember(db: PrismaClient, actorId: string, spaceId: string, input: {
  identityId: string; active: boolean; capabilities: unknown; expectedUpdatedAt: string;
}) {
  if (typeof input.identityId !== 'string' || !input.identityId || typeof input.active !== 'boolean' || !validOperatingCapabilities(input.capabilities)) {
    throw new OperatingAccessError('Select a person and valid capabilities', 400);
  }
  const capabilities = [...new Set(input.capabilities)];
  return db.$transaction(async tx => {
    await requireGovernanceFounder(tx, actorId);
    const space = await lockSpaceVersion(tx, spaceId, input.expectedUpdatedAt);
    const org = await tx.organization.findUnique({ where: { id: space.organizationId }, select: { status: true } });
    if (org?.status !== 'active') throw new OperatingAccessError('Organization is not active', 400);
    const target = await tx.identity.findUnique({ where: { id: input.identityId }, select: { id: true, status: true } });
    if (!target || (input.active && target.status !== 'active')) throw new OperatingAccessError('An active existing account is required', 400);
    const now = new Date();
    const attached = await tx.operatingSpaceUnit.findMany({ where: { operatingSpaceId: spaceId, active: true, startsOn: { lte: now }, OR: [{ endsOn: null }, { endsOn: { gt: now } }] }, select: { unitId: true } });
    const eligible = new Set((await eligibleOrganizationUnits(tx, space.organizationId, now)).map(u => u.id));
    const before = await tx.operatingSpaceMember.findUnique({ where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId: input.identityId } }, select: { active: true, capabilities: true } });
    const effectiveUnits: Record<string, number> = {};
    if (input.active) {
      if (!capabilities.length) throw new OperatingAccessError('Choose at least one capability or deactivate access', 400);
      for (const cap of capabilities) {
        if (!GOVERNED_DAILY_CAPABILITIES.includes(cap) && !(before?.active && before.capabilities.includes(cap))) {
          throw new OperatingAccessError(`New grants for ${cap} are not available in this daily-task setup.`, 409);
        }
        const ids = await getLegacyOperationalUnitIds(tx, input.identityId, CAPABILITY_DEPARTMENTS[cap], attached.map(u => u.unitId).filter(id => eligible.has(id)), space.organizationId);
        effectiveUnits[cap] = ids.length;
        if (!ids.length) throw new OperatingAccessError(`No effective unit access for ${cap}. Configure the existing project role and department or management mandate first.`, 409);
      }
    }
    const member = await tx.operatingSpaceMember.upsert({ where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId: input.identityId } },
      create: { operatingSpaceId: spaceId, identityId: input.identityId, active: input.active, capabilities },
      update: { active: input.active, capabilities },
    });
    await tx.auditLog.create({ data: { actorIdentityId: actorId, action: 'operating_space:member', entityType: 'OperatingSpaceMember', entityId: member.id,
      data: { operatingSpaceId: spaceId, identityId: input.identityId, before, after: { active: member.active, capabilities }, effectiveUnits },
    } });
    return { id: member.id, active: member.active, capabilities, effectiveUnits };
  });
}
