-- Canonical v3 operational tables are server-owned.
-- The application accesses them through the trusted server/database role, not
-- directly from Supabase anon/authenticated clients. Keep them fail-closed.

ALTER TABLE "service_quote_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_quote_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_reschedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_system" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_mapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_event_inbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_aggregate_checkpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_onboarding_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_onboarding_draft" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "service_quote_request" FROM anon, authenticated;
REVOKE ALL ON TABLE "service_quote_version" FROM anon, authenticated;
REVOKE ALL ON TABLE "booking_reschedule" FROM anon, authenticated;
REVOKE ALL ON TABLE "external_system" FROM anon, authenticated;
REVOKE ALL ON TABLE "external_mapping" FROM anon, authenticated;
REVOKE ALL ON TABLE "external_event_inbox" FROM anon, authenticated;
REVOKE ALL ON TABLE "external_aggregate_checkpoint" FROM anon, authenticated;
REVOKE ALL ON TABLE "property_onboarding_template" FROM anon, authenticated;
REVOKE ALL ON TABLE "project_onboarding_draft" FROM anon, authenticated;
