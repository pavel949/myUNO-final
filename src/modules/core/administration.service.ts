import type { Identity, Prisma, PrismaClient } from '@prisma/client';
import { advanceSessionGeneration } from '@/lib/session-generation';

type Db = PrismaClient | Prisma.TransactionClient;
export class AdministrationError extends Error {
  constructor(message: string, public readonly status = 403) { super(message); }
}

// The same key is used by the database's last-administrator trigger.
export async function lockAdministration(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(724682190001::bigint)`;
  // Surface invariant violations before returning from the service.
  // A separately reviewed offline recovery transaction explicitly defers this.
  await tx.$executeRaw`SET CONSTRAINTS protect_last_platform_administrator IMMEDIATE`;
}

export const accountSummary = (person: Identity) => ({
  id: person.id, firstName: person.firstName, lastName: person.lastName,
  email: person.email, status: person.status, isAdmin: person.isAdmin,
  preferredLocale: person.preferredLocale,
  isSuperAdmin: person.isSuperAdmin, updatedAt: person.updatedAt.toISOString(),
});

export async function administrativeActor(db: Db, actorId: string) {
  const actor = await db.identity.findUnique({ where: { id: actorId } });
  if (!actor || actor.status !== 'active') throw new AdministrationError('Active account required');
  return actor;
}

export async function protectSuperadministrator(db: Db, actorId: string, targetId: string) {
  const target = await db.identity.findUnique({ where: { id: targetId }, select: { isSuperAdmin: true } });
  if (!target?.isSuperAdmin) return;
  const actor = await administrativeActor(db, actorId);
  if (!actor.isSuperAdmin) throw new AdministrationError('Protected superadministrator account');
}

export async function platformAccountAuthority(db: Db, actorId: string, targetId: string) {
  const actor = await administrativeActor(db, actorId);
  if (!actor.isAdmin) throw new AdministrationError('Platform administration required');
  const target = await db.identity.findUnique({ where: { id: targetId } });
  if (!target) throw new AdministrationError('Account not found', 404);
  if (target.isSuperAdmin && !actor.isSuperAdmin) throw new AdministrationError('Protected superadministrator account');
  return { actor, target };
}

function record(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !fields.includes(key))) throw new AdministrationError('Unexpected account-management fields', 400);
  return value as Record<string, unknown>;
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 200 || value.trim() !== value)
    throw new AdministrationError('An exact account ID is required', 400);
}
function version(person: { updatedAt: Date }, expected: unknown) {
  if (typeof expected !== 'string' || expected !== person.updatedAt.toISOString())
    throw new AdministrationError('Account changed; refresh and review before saving', 409);
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
    throw new AdministrationError('Use a name between 1 and 100 characters', 400);
  return value.trim();
}
async function audit(tx: Prisma.TransactionClient, actorId: string, targetId: string, action: string, data: Prisma.InputJsonObject) {
  await tx.auditLog.create({ data: { actorIdentityId: actorId, entityType: 'Identity', entityId: targetId, action, data } });
}

/** All global disable/edit operations serialize with superadmin assignment and commit their audit atomically. */
export async function managePlatformAccount(db: PrismaClient, actorId: string, targetId: string, raw: unknown) {
  id(targetId);
  const input = record(raw, ['action', 'firstName', 'lastName', 'preferredLocale', 'expectedUpdatedAt']);
  if (typeof input.action !== 'string' || !['profile', 'block', 'unblock'].includes(input.action)) throw new AdministrationError('Unknown account action', 400);
  if (input.action !== 'profile' && ['firstName', 'lastName', 'preferredLocale'].some(key => key in input))
    throw new AdministrationError('Profile fields require a profile action', 400);
  return db.$transaction(async tx => {
    await lockAdministration(tx);
    await tx.$queryRaw`SELECT id FROM public.identity WHERE id = ${targetId} FOR UPDATE`;
    const { target } = await platformAccountAuthority(tx, actorId, targetId);
    if (input.expectedUpdatedAt !== undefined) version(target, input.expectedUpdatedAt);
    let changed: Identity;
    if (input.action === 'profile') {
      if (input.expectedUpdatedAt === undefined) throw new AdministrationError('Refresh the account before editing', 409);
      const firstName = name(input.firstName); const lastName = name(input.lastName);
      if (typeof input.preferredLocale !== 'string' || !['en', 'ru', 'th', 'zh'].includes(input.preferredLocale)) throw new AdministrationError('Unsupported language', 400);
      changed = await tx.identity.update({ where: { id: targetId }, data: { firstName, lastName, preferredLocale: input.preferredLocale } });
    } else {
      if (actorId === targetId) throw new AdministrationError('Cannot disable or restore your own administrative account');
      if (input.action === 'block' && target.status !== 'active' && target.status !== 'invited') throw new AdministrationError('Account is not active or invited', 409);
      if (input.action === 'unblock' && target.status !== 'blocked') throw new AdministrationError('Account is not blocked', 409);
      changed = await tx.identity.update({ where: { id: targetId }, data: { status: input.action === 'block' ? 'blocked' : 'active' } });
      // Old cookies must remain invalid even after a later unblock.
      await advanceSessionGeneration(tx, targetId);
    }
    await audit(tx, actorId, targetId, `administration.account_${input.action}`, {
      before: { status: target.status }, after: { status: changed.status },
      changedFields: input.action === 'profile' ? ['firstName', 'lastName', 'preferredLocale'] : ['status', 'sessionsValidFrom'],
    });
    return changed;
  });
}

/** Singleton owner: no bootstrap, successor appointment or self-demotion through HTTP. */
export async function setSuperAdministrator(db: PrismaClient, actorId: string, targetId: string, raw: unknown) {
  id(targetId);
  const input = record(raw, ['enabled', 'expectedUpdatedAt']);
  if (typeof input.enabled !== 'boolean') throw new AdministrationError('Choose enabled or disabled', 400);
  const enabled = input.enabled;
  return db.$transaction(async tx => {
    await lockAdministration(tx);
    const actor = await administrativeActor(tx, actorId);
    if (!actor.isSuperAdmin || !actor.isAdmin) throw new AdministrationError('Protected superadministrator required');
    if (targetId !== actorId) throw new AdministrationError('The sole superadministrator cannot appoint another superadministrator');
    const target = await tx.identity.findUnique({ where: { id: targetId } });
    if (!target) throw new AdministrationError('Account not found', 404);
    version(target, input.expectedUpdatedAt);
    if (!enabled) throw new AdministrationError('Cannot demote your own sole superadministrator account');
    if (enabled && (target.status !== 'active' || !target.emailVerifiedAt || !target.hashedPassword))
      throw new AdministrationError('An active verified account with a configured password is required', 409);
    // An idempotent assertion of the existing binding, never a privilege writer.
    // First assignment and recovery are deliberately unavailable through HTTP.
    return accountSummary(target);
  });
}

/** A workspace administrator is a distinct membership flag, never a global Identity privilege. */
export async function workspaceAdministrator(db: Db, actorId: string, spaceId: string) {
  const actor = await administrativeActor(db, actorId);
  const space = await db.operatingSpace.findUnique({ where: { id: spaceId }, include: { organization: { select: { status: true } } } });
  if (!space || space.status !== 'active' || space.organization.status !== 'active') throw new AdministrationError('Workspace unavailable', 404);
  if (actor.isSuperAdmin && actor.isAdmin) return { actor, space };
  const member = await db.operatingSpaceMember.findUnique({ where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId: actorId } } });
  if (!member?.active || !member.isAdministrator) throw new AdministrationError('Workspace administration required');
  return { actor, space };
}

export async function setWorkspaceAdministrator(db: PrismaClient, actorId: string, spaceId: string, targetId: string, raw: unknown) {
  id(targetId); id(spaceId);
  const input = record(raw, ['enabled', 'expectedUpdatedAt']);
  if (typeof input.enabled !== 'boolean') throw new AdministrationError('Choose enabled or disabled', 400);
  const enabled = input.enabled;
  return db.$transaction(async tx => {
    await lockAdministration(tx);
    const { actor } = await workspaceAdministrator(tx, actorId, spaceId);
    if (!actor.isSuperAdmin) throw new AdministrationError('Only a protected superadministrator can appoint workspace administrators');
    const target = await tx.identity.findUnique({ where: { id: targetId } });
    if (!target) throw new AdministrationError('Account not found', 404);
    if (enabled && (target.status !== 'active' || !target.hashedPassword || target.isAdmin || target.isSuperAdmin))
      throw new AdministrationError('Choose an active password account without global administration', 409);
    if (enabled) {
      const workRole = await tx.roleAssignment.findFirst({ where: { identityId: targetId, status: 'active',
        role: { in: ['staff_ops', 'onsite_host', 'mc_member', 'juristic_member', 'provider_member', 'content_contributor', 'pricing_editor', 'booking_mode_editor'] },
      }, select: { id: true } });
      const otherMembership = await tx.operatingSpaceMember.findFirst({ where: {
        identityId: targetId, active: true, operatingSpaceId: { not: spaceId },
      }, select: { id: true } });
      if (workRole || otherMembership) throw new AdministrationError('Review existing work roles and other workspace memberships before appointing a scoped administrator', 409);
    }
    const where = { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId: targetId } };
    const before = await tx.operatingSpaceMember.findUnique({ where });
    if (!enabled && !before) throw new AdministrationError('Workspace administrator not found', 404);
    if (before) version(before, input.expectedUpdatedAt);
    else if (input.expectedUpdatedAt !== null) throw new AdministrationError('Review the new membership before saving', 409);
    const member = await tx.operatingSpaceMember.upsert({ where,
      create: { operatingSpaceId: spaceId, identityId: targetId, isAdministrator: enabled, active: enabled },
      update: { isAdministrator: enabled, ...(enabled ? { active: true } : {}) },
    });
    await audit(tx, actorId, targetId, 'administration.workspace_admin_changed', {
      operatingSpaceId: spaceId, before: { isAdministrator: before?.isAdministrator ?? false }, after: { isAdministrator: member.isAdministrator },
    });
    return { id: member.id, identityId: targetId, operatingSpaceId: spaceId, active: member.active,
      isAdministrator: member.isAdministrator, updatedAt: member.updatedAt.toISOString() };
  });
}

/** Local disable never changes a person's global status, password, roles, or other workspaces. */
export async function manageWorkspaceAccount(db: PrismaClient, actorId: string, spaceId: string, targetId: string, raw: unknown) {
  id(targetId); id(spaceId);
  const input = record(raw, ['action', 'displayName', 'expectedUpdatedAt']);
  if (typeof input.action !== 'string' || !['profile', 'disable', 'enable'].includes(input.action) ||
    (input.action !== 'profile' && 'displayName' in input)) throw new AdministrationError('Invalid workspace account action', 400);
  return db.$transaction(async tx => {
    await lockAdministration(tx);
    const { actor } = await workspaceAdministrator(tx, actorId, spaceId);
    const target = await tx.identity.findUnique({ where: { id: targetId } });
    const where = { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId: targetId } };
    const member = await tx.operatingSpaceMember.findUnique({ where });
    if (!target || !member) throw new AdministrationError('Workspace member not found', 404);
    if ((target.isAdmin || target.isSuperAdmin || member.isAdministrator) && !actor.isSuperAdmin)
      throw new AdministrationError('Protected administrative account');
    version(member, input.expectedUpdatedAt);
    if (actorId === targetId && input.action !== 'profile') throw new AdministrationError('Cannot change your own administrative access');
    if (input.action === 'enable' && target.status !== 'active') throw new AdministrationError('An active account is required', 409);
    const changed = await tx.operatingSpaceMember.update({ where, data: input.action === 'profile'
      ? { displayName: name(input.displayName) } : { active: input.action === 'enable' } });
    await audit(tx, actorId, targetId, `administration.workspace_account_${input.action}`, {
      operatingSpaceId: spaceId, before: { active: member.active }, after: { active: changed.active },
      changedFields: input.action === 'profile' ? ['displayName'] : ['active'],
    });
    return { id: changed.id, identityId: targetId, active: changed.active, displayName: changed.displayName,
      isAdministrator: changed.isAdministrator, updatedAt: changed.updatedAt.toISOString() };
  });
}
