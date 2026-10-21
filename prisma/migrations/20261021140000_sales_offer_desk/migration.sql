-- CreateTable
CREATE TABLE "sales_tariff_validation" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "reviewed_by_identity_id" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_through" DATE NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_tariff_validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operating_space_id" TEXT NOT NULL,
    "created_by_identity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "locale" TEXT NOT NULL,
    "client_note" TEXT NOT NULL,
    "salesperson_name" TEXT NOT NULL,

    CONSTRAINT "sales_offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_option" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "unit_id" TEXT NOT NULL,
    "validation_id" TEXT,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "sales_offer_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_share" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_by_identity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sales_offer_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_tariff_validation_unit_id_fingerprint_idx" ON "sales_tariff_validation"("unit_id", "fingerprint");

-- CreateIndex
CREATE INDEX "sales_tariff_validation_reviewed_by_identity_id_idx" ON "sales_tariff_validation"("reviewed_by_identity_id");

-- CreateIndex
CREATE INDEX "sales_offer_operating_space_id_created_at_idx" ON "sales_offer"("operating_space_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_offer_created_by_identity_id_idx" ON "sales_offer"("created_by_identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_offer_series_id_version_key" ON "sales_offer"("series_id", "version");

-- CreateIndex
CREATE INDEX "sales_offer_option_unit_id_idx" ON "sales_offer_option"("unit_id");

-- CreateIndex
CREATE INDEX "sales_offer_option_validation_id_idx" ON "sales_offer_option"("validation_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_offer_option_offer_id_position_key" ON "sales_offer_option"("offer_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sales_offer_share_token_hash_key" ON "sales_offer_share"("token_hash");

-- CreateIndex
CREATE INDEX "sales_offer_share_offer_id_idx" ON "sales_offer_share"("offer_id");

-- CreateIndex
CREATE INDEX "sales_offer_share_created_by_identity_id_idx" ON "sales_offer_share"("created_by_identity_id");

-- AddForeignKey
ALTER TABLE "sales_tariff_validation" ADD CONSTRAINT "sales_tariff_validation_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_tariff_validation" ADD CONSTRAINT "sales_tariff_validation_reviewed_by_identity_id_fkey" FOREIGN KEY ("reviewed_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer" ADD CONSTRAINT "sales_offer_operating_space_id_fkey" FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer" ADD CONSTRAINT "sales_offer_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_option" ADD CONSTRAINT "sales_offer_option_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "sales_offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_option" ADD CONSTRAINT "sales_offer_option_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_option" ADD CONSTRAINT "sales_offer_option_validation_id_fkey" FOREIGN KEY ("validation_id") REFERENCES "sales_tariff_validation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_share" ADD CONSTRAINT "sales_offer_share_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "sales_offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_share" ADD CONSTRAINT "sales_offer_share_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Server-only Prisma access; browser/Data API receives no grants or policies.
ALTER TABLE sales_tariff_validation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_offer ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_offer_option ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales_tariff_validation, sales_offer, sales_offer_option FROM anon, authenticated, service_role;
ALTER TABLE sales_offer ADD CONSTRAINT sales_offer_version_positive CHECK (version > 0),
  ADD CONSTRAINT sales_offer_locale CHECK (locale IN ('en', 'ru', 'th')),
  ADD CONSTRAINT sales_offer_expiry CHECK (expires_at > created_at);
ALTER TABLE sales_tariff_validation ADD CONSTRAINT sales_validation_period CHECK (valid_through > valid_from),
  ADD CONSTRAINT sales_validation_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT sales_validation_currency CHECK (currency = 'THB');
ALTER TABLE sales_offer_option ADD CONSTRAINT sales_option_position CHECK (position BETWEEN 0 AND 3);
-- Immutable document history; corrections are new versions. Test cleanup uses replica mode.
CREATE FUNCTION sales_offer_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Sales offer snapshots are immutable; create a revision'; END;
$$;
CREATE TRIGGER sales_offer_immutable BEFORE UPDATE OR DELETE ON sales_offer
  FOR EACH ROW EXECUTE FUNCTION sales_offer_immutable();
CREATE TRIGGER sales_offer_option_immutable BEFORE UPDATE OR DELETE ON sales_offer_option
  FOR EACH ROW EXECUTE FUNCTION sales_offer_immutable();

ALTER TABLE sales_offer_share ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales_offer_share FROM anon, authenticated, service_role;
ALTER TABLE sales_offer_share ADD CONSTRAINT sales_share_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT sales_share_expiry CHECK (expires_at > created_at);
CREATE FUNCTION sales_offer_option_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sales_offer WHERE id = NEW.offer_id
    AND xmin::text::bigint = (txid_current() % 4294967296)) THEN
    RAISE EXCEPTION 'Options must be inserted with their new offer in the same transaction';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sales_offer_option_insert_guard BEFORE INSERT ON sales_offer_option
  FOR EACH ROW EXECUTE FUNCTION sales_offer_option_insert_guard();
CREATE FUNCTION sales_offer_option_count_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM sales_offer_option WHERE offer_id = NEW.id) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'An offer must contain one to four alternatives';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER sales_offer_option_count_guard AFTER INSERT ON sales_offer
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sales_offer_option_count_guard();
