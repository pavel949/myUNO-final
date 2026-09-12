-- Service-order finalisation: the confirm/dispute window (doc 07 F-PROV-3).
--
-- `closed` already existed in the ServiceOrderStatus enum but nothing ever
-- wrote it: a fulfilled order stayed disputable forever. These two columns
-- record how an order reached its terminal state — `closed_by_identity_id`
-- names the orderer who confirmed early, and stays NULL when the nightly job
-- closed the order because the window simply lapsed.

ALTER TABLE "service_order"
  ADD COLUMN "closed_at" TIMESTAMP(3),
  ADD COLUMN "closed_by_identity_id" TEXT;

ALTER TABLE "service_order"
  ADD CONSTRAINT "service_order_closed_by_identity_id_fkey"
  FOREIGN KEY ("closed_by_identity_id") REFERENCES "identity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
