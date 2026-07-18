-- T-022: Add service approval tracking fields
ALTER TABLE service ADD COLUMN approved_at TIMESTAMP NULL;
ALTER TABLE service ADD COLUMN approved_by_identity_id TEXT NULL;

-- Add foreign key constraint
ALTER TABLE service ADD CONSTRAINT service_approved_by_fk
  FOREIGN KEY (approved_by_identity_id) REFERENCES identity(id) ON DELETE SET NULL;

-- Add index for querying unapproved services
CREATE INDEX idx_service_approval ON service(approved_at, status);
