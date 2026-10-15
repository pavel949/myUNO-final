-- Additive: existing reservations retain their collection eligibility and amounts.
CREATE TYPE "BookingReceivableStatus" AS ENUM ('collectible', 'pending_reconciliation');
ALTER TABLE "booking" ADD COLUMN "receivable_status" "BookingReceivableStatus" NOT NULL DEFAULT 'collectible';

-- A source-paid claim cannot authorize a new collection attempt or receipt.
-- Only INSERT is guarded: an already verified provider outcome must remain recordable.
-- Checkout inserts its durable claim before any provider network operation.
CREATE FUNCTION guard_booking_receivable_payment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE review_status "BookingReceivableStatus";
BEGIN
  IF NEW.booking_id IS NOT NULL AND NEW.purpose IN ('stay', 'stay_balance') THEN
    SELECT receivable_status INTO review_status FROM booking WHERE id = NEW.booking_id FOR SHARE;
    IF review_status = 'pending_reconciliation' THEN
      RAISE EXCEPTION 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_booking_receivable_guard BEFORE INSERT ON payment
FOR EACH ROW EXECUTE FUNCTION guard_booking_receivable_payment();

-- A statement may not recognize/distribute unresolved source claims, including
-- through legacy callers that bypass the snapshot service. The same unit lock
-- used by channel intake closes the import-versus-financial-close race.
CREATE FUNCTION assert_period_receivables_resolved(p_unit_id TEXT, p_start TIMESTAMP, p_end TIMESTAMP) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_unit_id));
  IF EXISTS (SELECT 1 FROM booking WHERE unit_id = p_unit_id
    AND receivable_status = 'pending_reconciliation'
    AND status IN ('confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled')
    AND start_date < p_end + INTERVAL '1 day' AND end_date > p_start) THEN
    RAISE EXCEPTION 'STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION guard_statement_receivable_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.signed_off_by_operator_at IS NOT DISTINCT FROM OLD.signed_off_by_operator_at
    AND NEW.signed_off_by_owner_at IS NOT DISTINCT FROM OLD.signed_off_by_owner_at THEN RETURN NEW; END IF;
  -- Superseding a statement is a correction, not a new financial close.
  IF NEW.status <> 'superseded' THEN
    PERFORM assert_period_receivables_resolved(NEW.unit_id, NEW.period_start, NEW.period_end);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER owner_statement_receivable_guard BEFORE INSERT OR UPDATE OF status, signed_off_by_operator_at, signed_off_by_owner_at ON owner_statement
FOR EACH ROW EXECUTE FUNCTION guard_statement_receivable_review();

CREATE FUNCTION guard_owner_payout_receivable_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE statement_row owner_statement%ROWTYPE;
BEGIN
  IF NEW.payee_type = 'owner' AND NEW.owner_statement_id IS NOT NULL THEN
    SELECT * INTO statement_row FROM owner_statement WHERE id = NEW.owner_statement_id;
    IF FOUND THEN
      PERFORM assert_period_receivables_resolved(statement_row.unit_id, statement_row.period_start, statement_row.period_end);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payout_receivable_guard BEFORE INSERT ON payout
FOR EACH ROW EXECUTE FUNCTION guard_owner_payout_receivable_review();

-- Represent missing source party facts without inventing an adult. The existing
-- non-negative party constraint remains untouched. Ordinary reservations still
-- require an adult; source_unknown is scoped to evidenced operator imports.
CREATE TYPE "BookingPartyDetailsStatus" AS ENUM ('known', 'source_unknown');
ALTER TABLE "booking" ADD COLUMN "party_details_status" "BookingPartyDetailsStatus" NOT NULL DEFAULT 'known';
ALTER TABLE "booking" DROP CONSTRAINT "booking_has_an_adult";
ALTER TABLE "booking" ADD CONSTRAINT "booking_has_an_adult"
  CHECK (adults >= 1 OR party_details_status = 'source_unknown');
ALTER TABLE "booking" ADD CONSTRAINT "booking_unknown_party_source_evidence"
  CHECK (party_details_status = 'known' OR (
    booking_type = 'external_ota'
    AND NULLIF(btrim(external_ref), '') IS NOT NULL
    AND (price_breakdown->>'importedFrom' = 'operator_workbook') IS TRUE
    AND jsonb_typeof(price_breakdown->'sourcePartyEvidence') = 'object'
    AND NULLIF(btrim(price_breakdown#>>'{sourcePartyEvidence,provenance}'), '') IS NOT NULL
  ) IS TRUE);
ALTER TABLE "booking" ADD CONSTRAINT "booking_checkin_requires_known_party"
  CHECK (status <> 'checked_in' OR party_details_status = 'known');

-- These guards are internal server routines, not public Data API RPCs.
-- Preserve the migration owner and existing server-role grants.
REVOKE EXECUTE ON FUNCTION public.guard_booking_receivable_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_period_receivables_resolved(TEXT, TIMESTAMP, TIMESTAMP) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_statement_receivable_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_owner_payout_receivable_review() FROM PUBLIC, anon, authenticated;
