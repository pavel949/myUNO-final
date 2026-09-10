// module: projects — public interface
// Owns: Project and Unit persistence and business logic
// Used by: admin panel, project/unit queries throughout the app

export {
  createProject,
  getProject,
  getProjectBySlug,
  listProjects,
  updateProject,
  getProjectDetail,
} from './projects';

export {
  listPublicProjects,
  getPublicProjectBySlug,
  listPublicUnitIds,
  getPublicUnitById,
  type PublicProjectCard,
  type PublicProjectDetail,
  type PublicProjectUnit,
  type PublicUnitDetail,
} from './public.service';

export {
  getResidences,
  type Residence,
  type ResidenceAnnouncement,
  type ResidenceService,
} from './residence.service';

export {
  createUnit,
  getUnit,
  listUnits,
  updateUnit,
  confirmPermittedUse,
  getUnitDetail,
} from './units';

export {
  bookOwnerStay,
  getOwnerDashboard,
  getOwnerBookingsList,
  getOwnerPortfolioShape,
  getOwnerProjects,
  getOwnerAlerts,
  getOwnerComplianceSummary,
  getOwnerStatements,
  getOwnerUnitDashboard,
  type OwnerDashboardData,
  type OwnerStayInput,
  type OwnerAlert,
  type OwnerComplianceStatus,
} from './owner.service';

export { resolveOwnerPortalPath, singleOwnerUnitId } from './owner-landing';

export {
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCDashboard,
  getMCFeeReport,
  getMCServiceOrders,
  getMcTm30Queue,
  getMcMobilizationQueue,
  getMcIcalConflictAlerts,
  getMcBookingRequests,
  type McMobilizationUnit,
  type McBookingRequest,
} from './mc.service';

export {
  setUnitOwner,
  getOwnerAt,
  getOwnershipHistory,
  ensureOwnershipRecorded,
} from './ownership.service';

export {
  onboardUnitOwner,
  type OnboardUnitOwnerInput,
} from './owner-onboarding.service';

export {
  listOnboardingTemplates,
  getProjectOnboardingDraft,
  saveProjectOnboardingDraft,
} from './onboarding-draft.service';

export {
  listAreas,
  listBrowsableAreas,
  getAreaForBrowse,
  createArea,
  updateArea,
  buildAreaTree,
  collectDescendantIds,
  wouldFormCycle,
  resolveAreaLabelKey,
  getAreaPerformance,
  getPortfolioByArea,
  type AreaNode,
  type AreaTreeNode,
  type SaveAreaInput,
  type AreaPerformance,
} from './area.service';

export {
  createDeveloperOrganization,
  addProjectOrganizationRole,
  getDeveloper360,
  getProjectFacts360,
  getUnitFacts360,
  calculatePropertyFactsCompleteness,
  calculateDeveloperCompleteness,
} from './property-facts.service';

export {
  PROJECT_TYPES,
  ORGANIZATION_ROLES,
  PROJECT_FACILITIES,
  BED_TYPES,
  VIEWS,
  OWNERSHIP_TENURES,
  BLOCKING_REASONS,
  getLabel,
} from './taxonomies';
