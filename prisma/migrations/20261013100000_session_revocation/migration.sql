-- Revocable sessions. Additive and nullable: NULL means "no revocation has ever happened",
-- so every existing session stays valid. A token issued before this instant is refused
-- (src/lib/session.ts). No index: it is read by primary key with the identity row.
ALTER TABLE "identity" ADD COLUMN "sessions_valid_from" TIMESTAMP(3);
