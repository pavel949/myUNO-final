// module: core — public interface (see docs/14_tech_spec.md §3)
// Owns: Identity, Project, Unit, RoleAssignment, permissions
// Used by: all other modules for identity & role resolution

export {
  can,
  getIdentityRoles,
  hasRole,
  PERMISSIONS,
  type AccessLevel,
} from './permissions';

export {
  grantRole,
  revokeRole,
  getIdentityRoleAssignments,
  getProjectRoleAssignments,
  getUnitRoleAssignments,
  getIdentitiesWithRole,
} from './roles';

export * as people from './people.service';

export {
  getApplicableSeasonMarkup,
  getApplicableNightlyPrice,
  computePriceBreakdown,
  isActiveHold,
  checkAvailability,
  type PriceBreakdown,
} from './availability.service';
