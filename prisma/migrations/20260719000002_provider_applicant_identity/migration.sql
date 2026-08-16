-- Provider applications record the applicant identity: the provider_member
-- role and the N-18/N-19 vetting notifications go to the applicant (F-PROV-1).
ALTER TABLE "provider" ADD COLUMN IF NOT EXISTS "applicant_identity_id" TEXT;
ALTER TABLE "provider" ADD CONSTRAINT "provider_applicant_identity_id_fkey"
  FOREIGN KEY ("applicant_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
