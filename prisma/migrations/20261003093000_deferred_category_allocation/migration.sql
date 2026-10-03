-- Deferred category allocation keeps Booking.unit_id non-null so the existing
-- booking_no_overlap exclusion constraint remains the final capacity guard.
-- A category booking uses the current unit_id as an internal provisional
-- capacity slot until operations finalizes the physical villa.

CREATE TYPE "BookingAllocationStatus" AS ENUM ('final','category_reserved');
ALTER TYPE "BookingChangeType" ADD VALUE IF NOT EXISTS 'unit';

ALTER TABLE "booking"
  ADD COLUMN "requested_inventory_category_id" TEXT,
  ADD COLUMN "allocation_status" "BookingAllocationStatus" NOT NULL DEFAULT 'final',
  ADD COLUMN "allocation_finalized_at" TIMESTAMP(3),
  ADD COLUMN "allocation_finalized_by_identity_id" TEXT;

CREATE INDEX "booking_requested_category_allocation_idx"
  ON "booking"("requested_inventory_category_id","allocation_status","status","start_date","end_date");

ALTER TABLE "booking"
  ADD CONSTRAINT "booking_requested_inventory_category_id_fkey"
  FOREIGN KEY ("requested_inventory_category_id") REFERENCES "inventory_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_allocation_finalized_by_identity_id_fkey"
  FOREIGN KEY ("allocation_finalized_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking"
  ADD CONSTRAINT "booking_category_allocation_state_chk"
  CHECK (
    ("allocation_status" = 'final')
    OR
    (
      "allocation_status" = 'category_reserved'
      AND "requested_inventory_category_id" IS NOT NULL
      AND "checked_in_at" IS NULL
    )
  );
