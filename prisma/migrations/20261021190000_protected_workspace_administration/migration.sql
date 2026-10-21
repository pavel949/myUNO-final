-- Additive only: no identities or memberships are elevated by this migration.
ALTER TABLE identity ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;
ALTER TABLE identity ADD CONSTRAINT super_admin_requires_platform_admin
  CHECK (NOT is_super_admin OR (is_admin AND status = 'active'));
CREATE UNIQUE INDEX identity_single_superadministrator ON identity ((1)) WHERE is_super_admin;
ALTER TABLE operating_space_member ADD COLUMN is_administrator boolean NOT NULL DEFAULT false;
ALTER TABLE operating_space_member ADD COLUMN display_name text;
ALTER TABLE operating_space_member ADD CONSTRAINT workspace_display_name_bounded
  CHECK (display_name IS NULL OR (length(display_name) BETWEEN 1 AND 100));

-- At most one superadministrator, including inactive accounts. No email-based authority.
-- Loss protection is deferred so an approved offline recovery transaction can first
-- demote the old verified identity and then bind the replacement before COMMIT.
-- Bootstrap deliberately remains an explicitly approved, verified assignment outside migration.
CREATE FUNCTION protect_last_platform_administrator() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'active' AND OLD.is_super_admin AND
      (TG_OP = 'DELETE' OR NEW.status <> 'active' OR NOT NEW.is_super_admin) THEN
    PERFORM pg_advisory_xact_lock(724682190001::bigint);
    IF NOT EXISTS (SELECT 1 FROM public.identity WHERE id <> OLD.id AND status = 'active' AND is_super_admin) THEN
      RAISE EXCEPTION 'Cannot remove the last active superadministrator' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER protect_last_platform_administrator
AFTER UPDATE OR DELETE ON identity DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION protect_last_platform_administrator();
