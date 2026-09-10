INSERT INTO "property_onboarding_template" (
  "template_key", "version", "name", "property_type", "configuration", "checklist", "active"
) VALUES
(
  'resort', 1, 'Resort', 'resort',
  '{"operating_model":"full_management","timezone":"Asia/Bangkok","capabilities":{"reservations":true,"housekeeping":true,"maintenance":true,"guest_services":true,"vendors":true,"finance":true,"owners":true,"content":true}}'::jsonb,
  '["identity","inventory","commercial","compliance","operations","publish"]'::jsonb,
  TRUE
),
(
  'managed_condo_units', 1, 'Managed condominium units', 'managed_condo_units',
  '{"operating_model":"managed_units","timezone":"Asia/Bangkok","capabilities":{"reservations":true,"housekeeping":true,"maintenance":true,"guest_services":true,"vendors":true,"finance":true,"owners":true,"content":true}}'::jsonb,
  '["identity","inventory","commercial","compliance","operations","publish"]'::jsonb,
  TRUE
),
(
  'standalone_villa', 1, 'Standalone villa', 'standalone_villa',
  '{"operating_model":"single_asset","timezone":"Asia/Bangkok","capabilities":{"reservations":true,"housekeeping":true,"maintenance":true,"guest_services":true,"vendors":true,"finance":true,"owners":true,"content":true}}'::jsonb,
  '["identity","inventory","commercial","compliance","operations","publish"]'::jsonb,
  TRUE
)
ON CONFLICT ("template_key", "version") DO NOTHING;
