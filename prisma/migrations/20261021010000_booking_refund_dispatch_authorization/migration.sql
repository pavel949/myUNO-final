-- Nullable expand-only marker. Historical requested refunds intentionally remain
-- unauthorized: old retries may have hidden an uncertain provider outcome.
-- New booking cancellation / reconciled retry writers authorize once; the
-- dispatcher consumes authorization atomically when claiming processing.
ALTER TABLE "refund" ADD COLUMN "dispatch_authorized_at" TIMESTAMP(3);
