-- PostgreSQL requires enum additions to commit before they can be used
-- by defaults or constraints in a later migration.

ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'preventive_maintenance';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'deep_cleaning';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'restocking';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'guest_request';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'prearrival';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'owner_request';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'utilities';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'pool';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'garden';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'pest_control';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'compliance';
ALTER TYPE "OperationalTaskType" ADD VALUE IF NOT EXISTS 'custom';
ALTER TYPE "OperationalTaskStatus" ADD VALUE IF NOT EXISTS 'blocked';
