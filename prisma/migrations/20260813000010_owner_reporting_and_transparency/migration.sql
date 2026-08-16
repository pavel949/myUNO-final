-- Phase 2: Owner Reporting & Transparency
-- Corporate Bible Integration: Monthly statements, fee transparency, distributable cash
-- Extends existing owner_statement table with new fields for transparency and audit

-- Extend OwnerStatementStatus enum with new Corporate Bible statuses
ALTER TYPE "OwnerStatementStatus" ADD VALUE 'pending_owner_review';
ALTER TYPE "OwnerStatementStatus" ADD VALUE 'signed_off';
ALTER TYPE "OwnerStatementStatus" ADD VALUE 'distributed';

-- Create LineItemCategory enum for statement line-item transparency
CREATE TYPE "LineItemCategory" AS ENUM (
  'booking_revenue',
  'refund',
  'service_fee',
  'operating_expense',
  'tax',
  'performance_fee'
);

-- Extend owner_statement with Corporate Bible transparency fields
ALTER TABLE "owner_statement"
  ADD COLUMN "gross_bookings_amount_thb" INTEGER,
  ADD COLUMN "guest_payments_received_thb" INTEGER,
  ADD COLUMN "service_fees_amount_thb" INTEGER,
  ADD COLUMN "operating_expenses_amount_thb" INTEGER,
  ADD COLUMN "taxes_amount_thb" INTEGER,
  ADD COLUMN "adjusted_noi_thb" INTEGER,
  ADD COLUMN "distributable_cash_thb" INTEGER,
  ADD COLUMN "performance_fee_amount_thb" INTEGER,
  ADD COLUMN "performance_fee_basis_text" TEXT,
  ADD COLUMN "signed_off_by_owner_at" TIMESTAMP(3),
  ADD COLUMN "signed_off_by_operator_at" TIMESTAMP(3),
  ADD COLUMN "approved_at" TIMESTAMP(3);

-- Statement line items (every booking, fee, expense) for line-item traceability
CREATE TABLE "statement_line_item" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "statement_id" TEXT NOT NULL,
  "category" "LineItemCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amount_thb" INTEGER NOT NULL,
  "booking_id" TEXT,
  "supporting_document_id" TEXT,

  CONSTRAINT "statement_line_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "statement_line_item_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "owner_statement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "statement_line_item_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indices for performance
CREATE INDEX "statement_line_item_statement_id_category_idx" ON "statement_line_item"("statement_id", "category");
CREATE INDEX "statement_line_item_booking_id_idx" ON "statement_line_item"("booking_id");
