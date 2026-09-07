-- CRM opportunity value onto the satang rail.
--
-- `crm_opportunity.value_thb` was the one monetary column in the schema holding
-- baht. Every write path stored what an operator typed into a ฿ field with no
-- multiplication, and every read path rendered it back unchanged — internally
-- consistent, and 100x apart from `booking.total_thb`, `payment.amount_thb`,
-- `owner_statement.*_amount_thb` and every other amount, all of which are
-- satang. CLAUDE.md's money rule and D11 (doc 01 §12) admit no exception, and
-- the collision is not hypothetical: D-3 exists precisely because pipeline
-- value and ledger revenue get summed into the same report.
--
-- The multiplication is safe under one assumption, stated here so it can be
-- checked before this is deployed: every existing row was entered as baht.
-- That holds for anything created through the admin pipeline form, which is
-- the only writer in the repository; a caller posting satang directly to
-- POST /api/admin/crm/opportunities would be over-corrected by this.
UPDATE "crm_opportunity"
SET "value_thb" = "value_thb" * 100
WHERE "value_thb" IS NOT NULL;
