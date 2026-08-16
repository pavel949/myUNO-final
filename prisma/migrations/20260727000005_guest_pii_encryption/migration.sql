-- DM-1: booking_guest.date_of_birth becomes TEXT so it can hold AES-256-GCM
-- ciphertext (doc 02 §3.2 🔒 fields; doc 12). No production data exists;
-- any dev rows are dropped rather than converted.
ALTER TABLE "booking_guest" ALTER COLUMN "date_of_birth" TYPE TEXT USING NULL;
