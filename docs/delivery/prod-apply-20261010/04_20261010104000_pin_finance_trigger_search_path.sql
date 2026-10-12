-- Step 4 of 4: 20261010104000_pin_finance_trigger_search_path. Paste ALL of it (last line must start with 'select'), press Run. Run steps in order.
BEGIN;
-- Pin search_path on the two trigger functions added by 20261010070000 and
-- 20261010102000 (same rule as 20260930120000_pin_trigger_function_search_path).
-- Definition-only change; no data is touched.
ALTER FUNCTION public.ledger_entry_manual_cost_immutable() SET search_path = public, pg_temp;
ALTER FUNCTION public.expense_receipt_immutable() SET search_path = public, pg_temp;

INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'0e9d6a0f7a0e6080b25d4cc8ac6e48d50a3eeedb27fa4a6f1d8a32dab3b27800','20261010104000_pin_finance_trigger_search_path',now(),now(),1,NULL);
COMMIT;
select migration_name, finished_at from "_prisma_migrations" where migration_name = '20261010104000_pin_finance_trigger_search_path';
