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
} from './mc.service';
