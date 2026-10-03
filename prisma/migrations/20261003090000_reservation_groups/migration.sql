-- Reservation groups coordinate multiple canonical Bookings.
-- Each child Booking keeps its own unit/date availability constraints.

CREATE TABLE "reservation_group" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "guest_identity_id" TEXT NOT NULL,
  "created_by_identity_id" TEXT,
  "operating_space_id" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "notes" TEXT,
  CONSTRAINT "reservation_group_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "booking" ADD COLUMN "reservation_group_id" TEXT;

CREATE INDEX "reservation_group_guest_identity_id_status_idx"
  ON "reservation_group"("guest_identity_id","status");
CREATE INDEX "reservation_group_operating_space_id_status_idx"
  ON "reservation_group"("operating_space_id","status");
CREATE INDEX "booking_reservation_group_id_idx"
  ON "booking"("reservation_group_id");

ALTER TABLE "reservation_group"
  ADD CONSTRAINT "reservation_group_guest_identity_id_fkey"
  FOREIGN KEY ("guest_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_group"
  ADD CONSTRAINT "reservation_group_created_by_identity_id_fkey"
  FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservation_group"
  ADD CONSTRAINT "reservation_group_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_reservation_group_id_fkey"
  FOREIGN KEY ("reservation_group_id") REFERENCES "reservation_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_group" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "reservation_group" FROM PUBLIC, anon, authenticated;
