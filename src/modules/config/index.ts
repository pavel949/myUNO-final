/**
 * Config module — editable business rules per doc 04
 * Resolves configuration values with scoping: unit → project → global
 * Every edit writes an audit trail in ConfigChange
 */

export { getConfig, setConfigOverride, clearConfigCache } from './config.service';
export { seedConfig } from './seed';
export { assertCatalogKeys, getCatalogKeys, type CatalogName } from './catalog';
export type {
  ConfigKey,
  AllConfig,
  ConfigScope,
  BookingConfig,
  EngagementConfig,
  PricingConfig,
  CancellationConfig,
  ServicesConfig,
  OtherConfig,
  CatalogConfig,
  SeasonPeriod,
  CancellationStep,
  CategoryRates,
  EarlyBirdConfig,
  UnitCategoryEntry,
} from './types';
