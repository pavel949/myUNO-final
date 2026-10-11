-- Pin search_path on the two trigger functions added by 20261010070000 and
-- 20261010102000 (same rule as 20260930120000_pin_trigger_function_search_path).
-- Definition-only change; no data is touched.
ALTER FUNCTION public.ledger_entry_manual_cost_immutable() SET search_path = public, pg_temp;
ALTER FUNCTION public.expense_receipt_immutable() SET search_path = public, pg_temp;
