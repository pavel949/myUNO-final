-- All booking channels commit to one durable domain event stream.
-- This is an outbox, not a second booking, finance or availability authority.
CREATE TABLE "unified_domain_event" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "project_id" TEXT,
  "unit_id" TEXT,
  "booking_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "delivered_at" TIMESTAMPTZ,
  "attempt_count" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "unified_domain_event_project_cursor_idx"
  ON "unified_domain_event"("project_id", "created_at", "id");
CREATE INDEX "unified_domain_event_booking_cursor_idx"
  ON "unified_domain_event"("booking_id", "created_at");
CREATE INDEX "unified_domain_event_pending_idx"
  ON "unified_domain_event"("delivered_at", "created_at");

ALTER TABLE "unified_domain_event" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "unified_domain_event" FROM PUBLIC;
REVOKE ALL ON "unified_domain_event" FROM anon, authenticated;
-- No direct Data API read/write; only the app server's scoped routes expose
-- safe projections. No personally identifying fields in outbox payloads.

CREATE OR REPLACE FUNCTION emit_unified_domain_event()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  b RECORD;
  resolved_project TEXT;
  resolved_unit TEXT;
  resolved_booking TEXT;
  kind TEXT;
  entity TEXT;
  entity_id TEXT;
  detail JSONB;
  emitted_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'booking' THEN
    IF TG_OP = 'UPDATE'
       AND (OLD.status,OLD.start_date,OLD.end_date,OLD.total_thb,OLD.balance_due_thb,OLD.refund_accrued_thb)
       IS NOT DISTINCT FROM
       (NEW.status,NEW.start_date,NEW.end_date,NEW.total_thb,NEW.balance_due_thb,NEW.refund_accrued_thb)
       THEN RETURN NEW; END IF;
    resolved_project := NEW.project_id;
    resolved_unit := NEW.unit_id;
    resolved_booking := NEW.id;
    kind := 'booking.' || lower(NEW.status::text);
    entity := 'Booking';
    entity_id := NEW.id;
    detail := jsonb_build_object(
      'status',NEW.status::text,'channel',NEW.channel::text,
      'startDate',NEW.start_date,'endDate',NEW.end_date,
      'totalSatang',NEW.total_thb,'balanceDueSatang',NEW.balance_due_thb,
      'refundAccruedSatang',NEW.refund_accrued_thb
    );
  ELSIF TG_TABLE_NAME = 'blocked_date' THEN
    IF TG_OP = 'UPDATE'
       AND (OLD.start_date,OLD.end_date,OLD.reason) IS NOT DISTINCT FROM
           (NEW.start_date,NEW.end_date,NEW.reason) THEN RETURN NEW; END IF;
    SELECT u.project_id INTO resolved_project FROM unit u
      WHERE u.id=COALESCE(NEW.unit_id,OLD.unit_id);
    resolved_unit := COALESCE(NEW.unit_id,OLD.unit_id);
    resolved_booking := NULL;
    kind := CASE WHEN TG_OP='DELETE' THEN 'inventory.block_removed' ELSE 'inventory.block_changed' END;
    entity := 'BlockedDate';
    entity_id := COALESCE(NEW.id,OLD.id);
    detail := jsonb_build_object('startDate',COALESCE(NEW.start_date,OLD.start_date),
      'endDate',COALESCE(NEW.end_date,OLD.end_date),
      'reason',COALESCE(NEW.reason,OLD.reason)::text);
  ELSIF TG_TABLE_NAME = 'payment' THEN
    IF NEW.status <> 'succeeded' OR
       (TG_OP='UPDATE' AND OLD.status='succeeded') OR NEW.booking_id IS NULL
       THEN RETURN NEW; END IF;
    SELECT x.project_id,x.unit_id INTO resolved_project,resolved_unit
      FROM booking x WHERE x.id=NEW.booking_id;
    resolved_booking := NEW.booking_id;
    kind := 'payment.succeeded';
    entity := 'Payment';
    entity_id := NEW.id;
    detail := jsonb_build_object('amountSatang',NEW.amount_thb,'purpose',NEW.purpose::text);
  ELSIF TG_TABLE_NAME = 'refund' THEN
    IF NEW.status <> 'succeeded' OR
       (TG_OP='UPDATE' AND OLD.status='succeeded') THEN RETURN NEW; END IF;
    SELECT x.project_id,x.unit_id,x.id INTO resolved_project,resolved_unit,resolved_booking
      FROM payment p JOIN booking x ON x.id=p.booking_id WHERE p.id=NEW.payment_id;
    kind := 'refund.succeeded';
    entity := 'Refund';
    entity_id := NEW.id;
    detail := jsonb_build_object('amountSatang',NEW.amount_thb);
  ELSIF TG_TABLE_NAME = 'ledger_entry' THEN
    resolved_project := NEW.project_id;
    resolved_unit := NEW.unit_id;
    resolved_booking := NEW.booking_id;
    kind := 'ledger.recorded';
    entity := 'LedgerEntry';
    entity_id := NEW.id;
    detail := jsonb_build_object('entryType',NEW.entry_type::text,'amountSatang',NEW.amount_thb);
  ELSE
    RETURN COALESCE(NEW,OLD);
  END IF;
  INSERT INTO unified_domain_event
    (project_id,unit_id,booking_id,entity_type,entity_id,event_type,payload)
  VALUES (resolved_project,resolved_unit,resolved_booking,entity,entity_id,kind,detail)
  RETURNING id INTO emitted_id;
  PERFORM pg_notify('myuno_domain_events', emitted_id);
  RETURN COALESCE(NEW,OLD);
END $$;

DROP TRIGGER IF EXISTS booking_unified_domain_event ON "booking";
CREATE TRIGGER booking_unified_domain_event
  AFTER INSERT OR UPDATE ON "booking" FOR EACH ROW EXECUTE FUNCTION emit_unified_domain_event();
DROP TRIGGER IF EXISTS blocked_date_unified_domain_event ON "blocked_date";
CREATE TRIGGER blocked_date_unified_domain_event
  AFTER INSERT OR UPDATE OR DELETE ON "blocked_date"
  FOR EACH ROW EXECUTE FUNCTION emit_unified_domain_event();
DROP TRIGGER IF EXISTS payment_unified_domain_event ON "payment";
CREATE TRIGGER payment_unified_domain_event
  AFTER INSERT OR UPDATE ON "payment" FOR EACH ROW EXECUTE FUNCTION emit_unified_domain_event();
DROP TRIGGER IF EXISTS refund_unified_domain_event ON "refund";
CREATE TRIGGER refund_unified_domain_event
  AFTER INSERT OR UPDATE ON "refund" FOR EACH ROW EXECUTE FUNCTION emit_unified_domain_event();
DROP TRIGGER IF EXISTS ledger_unified_domain_event ON "ledger_entry";
CREATE TRIGGER ledger_unified_domain_event
  AFTER INSERT ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION emit_unified_domain_event();
