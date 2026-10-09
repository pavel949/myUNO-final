-- A replay key belongs to a guest's original booking intent, not an assigned unit.
-- Existing bookings remain untouched and retain null keys.
ALTER TABLE "booking" ADD COLUMN "creation_key" VARCHAR(36),
                      ADD COLUMN "creation_fingerprint" VARCHAR(64);
CREATE UNIQUE INDEX "booking_guest_identity_id_creation_key_key"
  ON "booking"("guest_identity_id", "creation_key");
ALTER TABLE "booking" ADD CONSTRAINT "booking_creation_intent_pair"
  CHECK (("creation_key" IS NULL) = ("creation_fingerprint" IS NULL));
