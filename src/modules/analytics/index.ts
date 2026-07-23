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
