export { track } from './track';
export type { TrackDimensions } from './track';
export { rollupMetricsDaily, rollupMetricsRange } from './rollup';
export { getMetricsSeries, getUnitOccupancySparklines } from './query';
export type {
  MetricsSeriesOptions,
  MetricsPoint,
  UnitSparkPoint,
} from './query';
export {
  detectBuyerSignals,
  transitionBuyerSignal,
  flagPurchaseQuestion,
  createDirectInquiry,
} from './signals';
export { getAdminDashboardStats } from './dashboard.service';
export {
  occupancyByCategory,
  revenueByChannel,
  revenueSplit,
} from './reports.service';
export type {
  CategoryOccupancyRow,
  ChannelRevenueRow,
  RevenueSplit,
} from './reports.service';
export type { AdminDashboardStats } from './dashboard.service';
export {
  getKpiSummary,
  getServicesAttachRate,
  getDirectShare,
  getRepeatGuestRate,
  getTm30OnTimeRate,
  getTicketSlaHitRate,
} from './kpi.service';
export type { KpiSummary, KpiMetrics } from './kpi.service';

// A signed-in person saying they are thinking about buying: a signal into the
// funnel an admin already watches, and a thread so a human answers.
export {
  registerPurchaseInterest,
  type PurchaseInterestInput,
} from './buyer-interest.service';
