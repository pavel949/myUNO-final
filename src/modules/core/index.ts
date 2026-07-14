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

export {
  createComplianceRecord,
  updateComplianceRecord,
  getComplianceRecord,
  getUnitComplianceRecords,
  deleteComplianceRecord,
  checkMobilizationGate,
  completeMobilizationStep,
  getUnitMobilizationChecklist,
  isMobilizationComplete,
  initializeMobilizationChecklist,
  type CreateComplianceRecordInput,
  type UpdateComplianceRecordInput,
} from './compliance.service';

export {
  createUnitEngagement,
  updateUnitEngagement,
  getUnitEngagement,
  getActiveEngagement,
  getUnitEngagements,
  deleteUnitEngagement,
  type CreateUnitEngagementInput,
  type UpdateUnitEngagementInput,
} from './engagement.service';
