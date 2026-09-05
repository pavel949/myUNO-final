-- Add statement context for owner "question this statement" threads (doc 07 F-OWN-3).
ALTER TYPE "ThreadContextType" ADD VALUE IF NOT EXISTS 'statement';
