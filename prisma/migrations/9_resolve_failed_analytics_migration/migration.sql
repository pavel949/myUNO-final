-- Resolves the failed 1_add_analytics_tables migration
-- This migration was previously abandoned; the analytics tables were replaced
-- by the proper AnalyticsEvent and MetricDaily models in migration 0_init
-- This compensation migration allows subsequent migrations to proceed

-- No-op: the schema is already correct from migration 0_init
-- This migration exists only to mark the failed migration as handled
