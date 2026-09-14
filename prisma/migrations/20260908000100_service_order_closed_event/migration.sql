-- The order lifecycle's terminal transition becomes measurable (doc 13 §2).
-- Every other service-order transition already emits an event; `closed` is
-- the one that says the revenue is no longer reversible, so the take-rate is
-- only final once it fires.
ALTER TYPE "AnalyticsEventKey" ADD VALUE IF NOT EXISTS 'service_order_closed';
