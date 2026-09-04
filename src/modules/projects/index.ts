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

// What a resident sees. The role existed with nowhere to go — someone living in
// a myUNO building could not read an announcement or open the handbook.
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

export {
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCDashboard,
  getMCFeeReport,
  getMCServiceOrders,
} from './mc.service';

// Ownership history (chain of title). `Unit.ownerIdentityId` stays the current
// owner; these answer who owned it *then*, which is what money records need.
export {
  setUnitOwner,
  getOwnerAt,
  getOwnershipHistory,
  ensureOwnershipRecorded,
} from './ownership.service';

// Areas — a place inventory is described by, for the two jobs the founder
// named: browse (an area page, a search filter) and reporting (occupancy and
// revenue rolled up across a region). Depth is data, not schema.
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
