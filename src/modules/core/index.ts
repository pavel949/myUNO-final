// module: core — public interface (see docs/14_tech_spec.md §3)
// Owns: Identity, Project, Unit, RoleAssignment, permissions
// Used by: all other modules for identity & role resolution

export {
  can,
  canWriteAvailabilityAndPricing,
  getIdentityRoles,
  hasRole,
  isKnownPermissionAction,
  resolvePermissionAction,
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
  getUnitBlockedDates,
  createManualBlock,
  removeBlockedDate,
  getUnitPricingRules,
  createPricingRule,
  removePricingRule,
  type PriceBreakdown,
  type ManualBlockReason,
  type CreateManualBlockInput,
  type CreatePricingRuleInput,
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
  MOBILIZATION_STEPS,
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

export {
  deleteExpiredMediaAssets,
  anonymizeDeletedIdentities,
  expireOldTokens,
  exportIdentityData,
  requestIdentityDeletion,
  runRetentionJobs,
  scrubExpiredPassportData,
} from './retention.service';

// A person's own account: who they are, how they sign in, and what reaches
// them. The notification half is the PDPA withdrawal surface, not a nicety.
export {
  getAccountProfile,
  updateAccountProfile,
  changeAccountPassword,
  getNotificationSettings,
  setNotificationPreference,
  SUPPORTED_LOCALES,
  UNMUTABLE_TYPES,
  type AccountProfile,
  type UpdateProfileInput,
  type NotificationSetting,
} from './account.service';

// Where a person belongs when they arrive with no particular destination
// (doc 08 §5). Pure policy — the routing rule is worth reading and testing.
export {
  resolveLanding,
  availableSurfaces,
  type Landing,
  type LandingContext,
} from './landing';
