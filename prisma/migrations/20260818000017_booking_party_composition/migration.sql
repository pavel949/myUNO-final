-- A booking's party is more than a headcount.
--
-- Bookings recorded `adults` and `children` only. A villa's house rules turn on
-- pets — whether they are allowed at all, what the cleaning costs, which units
-- can take them — and the model had no way to express the question, let alone
-- the answer. Infants matter for a different reason: they need a cot rather than
-- a bed, and counting them against capacity turns a family of four into a party
-- the villa refuses.
--
-- Occupancy stays adults + children, the convention every OTA uses. Infants and
-- pets are recorded, and counted against their own limits rather than the bed
-- count.

ALTER TABLE "booking"
    ADD COLUMN "infants" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "pets" INTEGER NOT NULL DEFAULT 0;

-- Negative people are not a thing, and a booking that claims them would corrupt
-- every occupancy figure downstream.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_party_non_negative"
    CHECK ("adults" >= 0 AND "children" >= 0 AND "infants" >= 0 AND "pets" >= 0);

-- Somebody has to be responsible for the stay.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_has_an_adult"
    CHECK ("adults" >= 1);

-- Whether a unit takes pets at all, and how many. Null means the unit has not
-- said — which is not the same as "no", and is left for the operator to answer
-- rather than guessed here.
ALTER TABLE "unit"
    ADD COLUMN "pets_allowed" BOOLEAN,
    ADD COLUMN "max_pets" INTEGER;

ALTER TABLE "unit"
    ADD CONSTRAINT "unit_max_pets_non_negative"
    CHECK ("max_pets" IS NULL OR "max_pets" >= 0);
