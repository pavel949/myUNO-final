-- CreateTable
CREATE TABLE "imported_reservation_source" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_system_id" TEXT NOT NULL,
    "source_reference" TEXT NOT NULL,
    "reservation_group_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_row_digest" VARCHAR(64) NOT NULL,
    "workbook_sha256" VARCHAR(64) NOT NULL,
    "quoted_total_thb" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "source_payment_status" TEXT NOT NULL,
    "reported_paid_thb" INTEGER,
    "adults" INTEGER,
    "children" INTEGER,
    "source_evidence" JSONB NOT NULL,

    CONSTRAINT "imported_reservation_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_reservation_placement" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "blocked_date_id" TEXT NOT NULL,
    "source_unit_code" TEXT NOT NULL,
    "allocated_total_thb" INTEGER,

    CONSTRAINT "imported_reservation_placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_reservation_source_reservation_group_id_key" ON "imported_reservation_source"("reservation_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "imported_reservation_source_external_system_id_source_refer_key" ON "imported_reservation_source"("external_system_id", "source_reference");

-- CreateIndex
CREATE UNIQUE INDEX "imported_reservation_placement_blocked_date_id_key" ON "imported_reservation_placement"("blocked_date_id");

-- CreateIndex
CREATE UNIQUE INDEX "imported_reservation_placement_source_id_unit_id_key" ON "imported_reservation_placement"("source_id", "unit_id");

-- AddForeignKey
ALTER TABLE "imported_reservation_source" ADD CONSTRAINT "imported_reservation_source_external_system_id_fkey" FOREIGN KEY ("external_system_id") REFERENCES "external_system"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_reservation_source" ADD CONSTRAINT "imported_reservation_source_reservation_group_id_fkey" FOREIGN KEY ("reservation_group_id") REFERENCES "reservation_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_reservation_source" ADD CONSTRAINT "imported_reservation_source_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_reservation_placement" ADD CONSTRAINT "imported_reservation_placement_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "imported_reservation_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_reservation_placement" ADD CONSTRAINT "imported_reservation_placement_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_reservation_placement" ADD CONSTRAINT "imported_reservation_placement_blocked_date_id_fkey" FOREIGN KEY ("blocked_date_id") REFERENCES "blocked_date"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Imported source quote is historical evidence, never a receipt or per-villa sale.
ALTER TABLE imported_reservation_source ADD CONSTRAINT imported_source_money
  CHECK (quoted_total_thb >= 0 AND currency = 'THB' AND (reported_paid_thb IS NULL OR reported_paid_thb >= 0)
    AND (adults IS NULL OR adults > 0) AND (children IS NULL OR children >= 0));
ALTER TABLE imported_reservation_placement ADD CONSTRAINT imported_placement_amount_unknown CHECK (allocated_total_thb IS NULL);
ALTER TABLE imported_reservation_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_reservation_placement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON imported_reservation_source, imported_reservation_placement FROM anon, authenticated;

CREATE FUNCTION guard_imported_placement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE block_unit text; group_project text; unit_project text;
BEGIN
  SELECT unit_id INTO block_unit FROM blocked_date WHERE id=NEW.blocked_date_id FOR UPDATE;
  SELECT project_id INTO group_project FROM imported_reservation_source WHERE id=NEW.source_id;
  SELECT project_id INTO unit_project FROM unit WHERE id=NEW.unit_id;
  IF block_unit IS DISTINCT FROM NEW.unit_id OR group_project IS DISTINCT FROM unit_project THEN
    RAISE EXCEPTION 'IMPORTED_GROUP_PLACEMENT_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER imported_placement_scope BEFORE INSERT ON imported_reservation_placement FOR EACH ROW EXECUTE FUNCTION guard_imported_placement();

CREATE FUNCTION guard_imported_group_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'IMPORTED_GROUP_RECONCILIATION_REQUIRED' USING ERRCODE='23514'; END $$;
CREATE TRIGGER imported_source_immutable BEFORE UPDATE OR DELETE ON imported_reservation_source FOR EACH ROW EXECUTE FUNCTION guard_imported_group_immutable();
CREATE TRIGGER imported_placement_immutable BEFORE UPDATE OR DELETE ON imported_reservation_placement FOR EACH ROW EXECUTE FUNCTION guard_imported_group_immutable();
CREATE FUNCTION guard_imported_group_block() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM imported_reservation_placement WHERE blocked_date_id=OLD.id) THEN
   RAISE EXCEPTION 'IMPORTED_GROUP_PROTECTION_REQUIRES_RECONCILIATION' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER imported_group_block_guard BEFORE UPDATE OR DELETE ON blocked_date FOR EACH ROW EXECUTE FUNCTION guard_imported_group_block();

CREATE FUNCTION guard_booking_imported_group() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.reservation_group_id IS NOT NULL AND EXISTS(SELECT 1 FROM imported_reservation_source WHERE reservation_group_id=NEW.reservation_group_id) THEN
   RAISE EXCEPTION 'IMPORTED_GROUP_ALLOCATION_REQUIRED' USING ERRCODE='23514';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(NEW.unit_id));
 IF NEW.status IN ('confirmed','checked_in','pending_payment') AND EXISTS(
   SELECT 1 FROM imported_reservation_placement p JOIN blocked_date b ON b.id=p.blocked_date_id
   WHERE p.unit_id=NEW.unit_id AND b.start_date<NEW.end_date AND b.end_date>NEW.start_date
 ) THEN RAISE EXCEPTION 'IMPORTED_GROUP_DATES_PROTECTED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_imported_group_guard BEFORE INSERT OR UPDATE OF reservation_group_id,unit_id,start_date,end_date,status ON booking
FOR EACH ROW EXECUTE FUNCTION guard_booking_imported_group();

-- Preserve the existing booking reconciliation guard and include unallocated placements.
CREATE OR REPLACE FUNCTION assert_period_receivables_resolved(p_unit_id TEXT,p_start TIMESTAMP,p_end TIMESTAMP)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_unit_id));
 IF EXISTS(SELECT 1 FROM booking WHERE unit_id=p_unit_id AND receivable_status='pending_reconciliation'
   AND status IN ('confirmed','checked_in','checked_out','completed','cancelled')
   AND start_date<p_end+INTERVAL '1 day' AND end_date>p_start)
 OR EXISTS(SELECT 1 FROM imported_reservation_placement p JOIN blocked_date b ON b.id=p.blocked_date_id
   WHERE p.unit_id=p_unit_id AND b.start_date<p_end+INTERVAL '1 day' AND b.end_date>p_start) THEN
   RAISE EXCEPTION 'STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED' USING ERRCODE='23514';
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION guard_imported_placement(),guard_imported_group_immutable(),guard_imported_group_block(),guard_booking_imported_group() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION assert_period_receivables_resolved(TEXT,TIMESTAMP,TIMESTAMP) FROM PUBLIC,anon,authenticated;
