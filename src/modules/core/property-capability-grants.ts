import type { PrismaClient, Prisma } from '@prisma/client';
import { PropertyCapabilityError, readPropertyCapabilityAccess } from './property-capability-access';
import { capabilityExpiryWithin, capabilityScopeContains, isPropertyCapabilityRole, validCapabilityScope,
  type PropertyCapabilityGrant, type PropertyCapabilityRole } from './property-capability-policy';

export interface PropertyCapabilityGrantInput {
  identityId: string;
  role: PropertyCapabilityRole;
  scopeType: 'project' | 'unit';
  projectId: string;
  unitId?: string | null;
  canDelegate?: boolean;
  parentGrantId?: string | null;
  expiresAt?: string | null;
  expectedUpdatedAt?: string;
}

const cleanId = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 200 && value === value.trim();

export function parsePropertyCapabilityGrant(value: unknown): PropertyCapabilityGrantInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new PropertyCapabilityError('Invalid grant request', 400);
  const allowed = ['identityId', 'role', 'scopeType', 'projectId', 'unitId', 'canDelegate', 'parentGrantId', 'expiresAt', 'expectedUpdatedAt'];
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !allowed.includes(key) || !descriptor?.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new PropertyCapabilityError('Unexpected grant field', 400);
  }
  const input = value as PropertyCapabilityGrantInput;
  if (!cleanId(input.identityId) || !isPropertyCapabilityRole(input.role) || !cleanId(input.projectId) ||
    !validCapabilityScope({ ...input, unitId: input.unitId ?? null }) ||
    (input.canDelegate !== undefined && typeof input.canDelegate !== 'boolean') ||
    (input.parentGrantId != null && !cleanId(input.parentGrantId)) ||
    (input.expiresAt != null && typeof input.expiresAt !== 'string') ||
    (input.expectedUpdatedAt !== undefined && typeof input.expectedUpdatedAt !== 'string')) {
    throw new PropertyCapabilityError('Choose an exact valid capability scope', 400);
  }
  return input;
}

function expiry(value: string | null | undefined, now: Date): Date | null {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value || date <= now)
    throw new PropertyCapabilityError('Choose a future expiry time', 400);
  return date;
}

const auditShape = (grant: PropertyCapabilityGrant) => ({
  identityId: grant.identityId, role: grant.role, scopeType: grant.scopeType,
  projectId: grant.projectId, unitId: grant.unitId, status: grant.status,
  canDelegate: grant.canDelegate ?? false, parentGrantId: grant.parentGrantId ?? null,
  expiresAt: grant.expiresAt?.toISOString() ?? null,
});

/** Exact assignment and its audit commit together. No identity or invitation is created. */
export async function grantPropertyCapability(db: PrismaClient, actorIdentityId: string, raw: unknown) {
  const input = parsePropertyCapabilityGrant(raw);
  return db.$transaction(async tx => {
    const unitId = input.scopeType === 'unit' ? input.unitId! : null;
    if (unitId) {
      await tx.$queryRaw`SELECT id FROM unit WHERE id = ${unitId} FOR SHARE`;
      const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { projectId: true, status: true } });
      if (!unit || unit.projectId !== input.projectId || unit.status === 'offboarded')
        throw new PropertyCapabilityError('Unit is outside the selected active inventory', 400);
    } else {
      const project = await tx.project.findUnique({ where: { id: input.projectId }, select: { id: true, status: true } });
      if (!project || project.status === 'archived') throw new PropertyCapabilityError('Choose an active project', 400);
    }
    const access = await readPropertyCapabilityAccess(tx, actorIdentityId, input.role, true);
    const parent = access.actor.isAdmin ? null : access.grants.find(grant =>
      grant.id === input.parentGrantId && grant.canDelegate && grant.parentGrantId === null);
    if (access.actor.isAdmin && input.parentGrantId != null)
      throw new PropertyCapabilityError('Administrator assignments must explicitly use their own authority', 400);
    if (!access.actor.isAdmin && (!parent || input.canDelegate === true || input.identityId === actorIdentityId))
      throw new PropertyCapabilityError('A current delegable capability for this exact scope is required');
    await tx.$queryRaw`SELECT id FROM identity WHERE id = ${input.identityId} FOR SHARE`;
    const target = await tx.identity.findUnique({ where: { id: input.identityId }, select: { id: true, status: true } });
    if (!target || !['active', 'invited'].includes(target.status))
      throw new PropertyCapabilityError('Choose an existing active or invited account', 400);
    const now = new Date();
    const expiresAt = input.expiresAt === undefined && parent?.expiresAt ? parent.expiresAt : expiry(input.expiresAt, now);
    const proposed = { id: 'new', identityId: input.identityId, role: input.role, scopeType: input.scopeType,
      projectId: input.projectId, unitId, organizationId: null, providerId: null,
      canDelegate: access.actor.isAdmin && input.canDelegate === true, parentGrantId: parent?.id ?? null,
      expiresAt, status: 'active' as const, grantedByIdentityId: actorIdentityId };
    if (parent && (!capabilityScopeContains(parent, proposed) || !capabilityExpiryWithin(parent, proposed)))
      throw new PropertyCapabilityError('Delegation cannot exceed the manager’s capability, scope or expiry');
    const key = [input.identityId, input.role, input.projectId, unitId ?? '', parent?.id ?? 'root'].join(':');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`property-capability:${key}`}))`;
    const existing = await tx.roleAssignment.findFirst({ where: {
      identityId: input.identityId, role: input.role, scopeType: input.scopeType,
      projectId: input.projectId, unitId, organizationId: null, providerId: null, parentGrantId: parent?.id ?? null,
    }, orderBy: { createdAt: 'asc' } });
    if (existing) {
      await tx.$queryRaw`SELECT id FROM role_assignment WHERE id = ${existing.id} OR parent_grant_id = ${existing.id} ORDER BY id FOR UPDATE`;
      const current = await tx.roleAssignment.findUniqueOrThrow({ where: { id: existing.id } });
      if (current.status === 'active' && current.canDelegate === proposed.canDelegate &&
        (current.expiresAt?.toISOString() ?? null) === (expiresAt?.toISOString() ?? null))
        return { grant: current, alreadyGranted: true };
      if (input.expectedUpdatedAt !== current.updatedAt.toISOString())
        throw new PropertyCapabilityError('This assignment changed. Refresh and review it before updating.', 409);
      // Preserve immutable provenance. Reducing delegation also durably revokes
      // leaf grants, so restoring the root later cannot silently restore them.
      const revoked = !proposed.canDelegate
        ? await tx.roleAssignment.updateMany({ where: { parentGrantId: current.id, status: 'active' }, data: { status: 'revoked' } })
        : { count: 0 };
      const grant = await tx.roleAssignment.update({ where: { id: current.id }, data: {
        status: 'active', canDelegate: proposed.canDelegate, expiresAt,
      } });
      await tx.auditLog.create({ data: { actorIdentityId, action: 'property_capability.updated', entityType: 'RoleAssignment', entityId: grant.id,
        data: { before: auditShape(current), after: auditShape(grant), revokedChildren: revoked.count } as Prisma.InputJsonValue } });
      return { grant, alreadyGranted: false };
    }
    const { id: _unusedId, ...data } = proposed;
    const grant = await tx.roleAssignment.create({ data });
    await tx.auditLog.create({ data: { actorIdentityId, action: 'property_capability.granted', entityType: 'RoleAssignment', entityId: grant.id,
      data: auditShape(grant) as Prisma.InputJsonValue } });
    return { grant, alreadyGranted: false };
  }, { timeout: 30_000 });
}

export async function revokePropertyCapability(db: PrismaClient, actorIdentityId: string, roleAssignmentId: string) {
  if (!cleanId(roleAssignmentId)) throw new PropertyCapabilityError('Invalid assignment', 400);
  return db.$transaction(async tx => {
    const current = await tx.roleAssignment.findUnique({ where: { id: roleAssignmentId } });
    if (!current || !isPropertyCapabilityRole(current.role)) throw new PropertyCapabilityError('Assignment not found', 404);
    const access = await readPropertyCapabilityAccess(tx, actorIdentityId, current.role, true);
    if (!access.actor.isAdmin && !access.grants.some(grant => grant.canDelegate &&
      grant.parentGrantId === null && current.parentGrantId === grant.id && current.grantedByIdentityId === actorIdentityId))
      throw new PropertyCapabilityError('Only the administrator or current delegating manager can revoke this assignment');
    // Match the reader's stable lock order, including descendants, to avoid
    // taking the ancestor exclusively while a writer holds a leaf shared lock.
    await tx.$queryRaw`SELECT id FROM role_assignment WHERE id = ${roleAssignmentId} OR parent_grant_id = ${roleAssignmentId} ORDER BY id FOR UPDATE`;
    const grant = await tx.roleAssignment.findUniqueOrThrow({ where: { id: roleAssignmentId } });
    const revoked = await tx.roleAssignment.updateMany({ where: { parentGrantId: grant.id, status: 'active' }, data: { status: 'revoked' } });
    if (grant.status === 'revoked' && revoked.count === 0) return { grant, alreadyRevoked: true };
    const result = await tx.roleAssignment.update({ where: { id: grant.id }, data: { status: 'revoked' } });
    await tx.auditLog.create({ data: { actorIdentityId, action: 'property_capability.revoked', entityType: 'RoleAssignment', entityId: grant.id,
      data: { before: auditShape(grant), after: auditShape(result), revokedChildren: revoked.count } as Prisma.InputJsonValue } });
    return { grant: result, alreadyRevoked: false };
  }, { timeout: 30_000 });
}
