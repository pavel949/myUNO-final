-- A reconciliation write-off is not proof that money reached the guest.
-- Keep it distinct from succeeded so guest refund state and ledger reporting cannot lie.
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'written_off';
