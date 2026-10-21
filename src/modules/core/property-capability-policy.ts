/** Independent, narrowly scoped property capabilities. Never infer these from a job title. */
export const PROPERTY_CAPABILITY_ROLES = ['pricing_editor', 'booking_mode_editor'] as const;
export type PropertyCapabilityRole = typeof PROPERTY_CAPABILITY_ROLES[number];

export interface PropertyCapabilityGrant {
  id: string;
  identityId: string;
  role: string;
  status: string;
  scopeType: string;
  projectId: string | null;
  unitId: string | null;
  organizationId?: string | null;
  providerId?: string | null;
  grantedByIdentityId?: string | null;
  canDelegate?: boolean;
  parentGrantId?: string | null;
  expiresAt?: Date | null;
}

const id = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 200 && value === value.trim();

export function isPropertyCapabilityRole(value: unknown): value is PropertyCapabilityRole {
  return value === 'pricing_editor' || value === 'booking_mode_editor';
}

export function validCapabilityScope(grant: Pick<PropertyCapabilityGrant,
  'scopeType' | 'projectId' | 'unitId' | 'organizationId' | 'providerId'>): boolean {
  return id(grant.projectId) && grant.organizationId == null && grant.providerId == null &&
    ((grant.scopeType === 'project' && grant.unitId == null) ||
      (grant.scopeType === 'unit' && id(grant.unitId)));
}

export function capabilityScopeContains(parent: PropertyCapabilityGrant, child: PropertyCapabilityGrant): boolean {
  return validCapabilityScope(parent) && validCapabilityScope(child) && parent.projectId === child.projectId &&
    (parent.scopeType === 'project' || (child.scopeType === 'unit' && parent.unitId === child.unitId));
}

export function capabilityScopeMatches(grant: PropertyCapabilityGrant, resource: {
  projectId?: string; unitId?: string;
}): boolean {
  return validCapabilityScope(grant) && grant.projectId === resource.projectId &&
    (grant.scopeType === 'project' || grant.unitId === resource.unitId);
}

function unexpired(grant: PropertyCapabilityGrant, now: Date): boolean {
  return grant.expiresAt == null || (grant.expiresAt instanceof Date &&
    Number.isFinite(grant.expiresAt.getTime()) && grant.expiresAt > now);
}

export function capabilityExpiryWithin(parent: PropertyCapabilityGrant, child: PropertyCapabilityGrant): boolean {
  if (parent.expiresAt == null) return true;
  return child.expiresAt instanceof Date && Number.isFinite(child.expiresAt.getTime()) &&
    parent.expiresAt instanceof Date && Number.isFinite(parent.expiresAt.getTime()) &&
    child.expiresAt <= parent.expiresAt;
}

function activeShape(grant: PropertyCapabilityGrant, now: Date): boolean {
  return id(grant.id) && id(grant.identityId) && isPropertyCapabilityRole(grant.role) &&
    grant.status === 'active' && validCapabilityScope(grant) && unexpired(grant, now) &&
    (grant.canDelegate === undefined || typeof grant.canDelegate === 'boolean');
}

/** Caller supplies current DB rows and current identity states, never session claims. */
export function isEffectiveCapabilityGrant(input: {
  grant: PropertyCapabilityGrant;
  actorIdentityId: string;
  actorActive: boolean;
  parent?: PropertyCapabilityGrant | null;
  parentActorActive?: boolean;
  now?: Date;
}): boolean {
  const { grant, parent } = input;
  const now = input.now ?? new Date();
  if (!input.actorActive || grant.identityId !== input.actorIdentityId || !activeShape(grant, now)) return false;
  if (grant.parentGrantId == null) return true;
  if (!id(grant.parentGrantId) || grant.canDelegate === true || !parent ||
      !input.parentActorActive || !activeShape(parent, now)) return false;
  return parent.id === grant.parentGrantId && parent.id !== grant.id &&
    parent.parentGrantId == null && parent.canDelegate === true &&
    parent.role === grant.role && parent.identityId !== grant.identityId &&
    parent.identityId === grant.grantedByIdentityId &&
    capabilityScopeContains(parent, grant) && capabilityExpiryWithin(parent, grant);
}
