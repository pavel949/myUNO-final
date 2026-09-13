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
  computePriceBreakdown as computeLegacyPriceBreakdown,
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

// Canonical booking/commercial calculator. All module-level callers importing
// computePriceBreakdown from @/modules/core now resolve InventoryCategory +
// RatePlan first; the legacy calculator remains explicitly named for migration
// tests and compatibility diagnostics only.
export { computeCanonicalPriceBreakdown as computePriceBreakdown } from './canonical-pricing.service';

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
  getAdminComplianceOverview,
  type AdminComplianceOverview,
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

export {
  resolveLanding,
  availableSurfaces,
  type Landing,
  type LandingContext,
} from './landing';
