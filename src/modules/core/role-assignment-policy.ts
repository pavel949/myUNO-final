import { RoleScopeType, RoleType } from '@prisma/client';

interface RoleAssignmentScope {
  role: RoleType;
  scopeType: RoleScopeType;
  projectId?: string | null;
  unitId?: string | null;
  organizationId?: string | null;
  providerId?: string | null;
}

/** Validate before normalization: silently dropping IDs can broaden a grant. */
export function validateRoleAssignmentScope(input: RoleAssignmentScope): void {
  if (!Object.values(RoleType).includes(input.role)) throw new Error('Unknown role');
  if (!Object.values(RoleScopeType).includes(input.scopeType)) throw new Error('Unknown role scope');

  for (const key of ['projectId', 'unitId', 'organizationId', 'providerId'] as const) {
    const value = input[key];
    if (value != null && (typeof value !== 'string' || !value.trim() || value !== value.trim())) {
      throw new Error(`${key} must be a non-empty ID`);
    }
  }

  if (input.scopeType === 'platform' && (input.projectId != null || input.unitId != null)) {
    throw new Error('Platform-scoped roles cannot include projectId or unitId');
  }
  if (input.scopeType === 'project' && !input.projectId) {
    throw new Error('projectId is required for project-scoped roles');
  }
  if (input.scopeType === 'project' && input.unitId != null) {
    throw new Error('Project-scoped roles cannot include unitId');
  }
  if (input.scopeType === 'unit' && (!input.projectId || !input.unitId)) {
    throw new Error('Unit-scoped roles require projectId and unitId');
  }

  if (input.role === 'content_contributor') {
    if (input.scopeType !== 'project' && input.scopeType !== 'unit') {
      throw new Error('Content contributors require one project or one exact unit');
    }
    if (input.organizationId != null || input.providerId != null) {
      throw new Error('Content contributors cannot receive organization or provider scope');
    }
  }
}
