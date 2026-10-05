-- Homepage / discovery funnel instrumentation.
-- These are typed analytics events only; business-success events continue to
-- be emitted by their canonical server transitions.

ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'intent_selected';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'search_submitted';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'search_completed';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'search_failed';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'search_zero_results';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'result_opened';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'project_opened';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'unit_opened';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'service_opened';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'owner_goal_selected';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'lead_started';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'login_started';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'login_success';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'quote_succeeded';
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'quote_failed';
