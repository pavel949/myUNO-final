-- Filename generated with official Supabase CLI migration new. Not applied here.
-- Additive authority metadata only; no identities or grants are created/backfilled.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TYPE public."RoleType" ADD VALUE IF NOT EXISTS 'booking_mode_editor';
ALTER TABLE public.role_assignment
  ADD COLUMN can_delegate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN parent_grant_id TEXT,
  ADD COLUMN expires_at TIMESTAMP(3);
ALTER TABLE public.role_assignment ADD CONSTRAINT role_assignment_parent_grant_fk
  FOREIGN KEY (parent_grant_id) REFERENCES public.role_assignment(id) ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX role_assignment_parent_grant_id_idx ON public.role_assignment(parent_grant_id);
ALTER TABLE public.role_assignment ADD CONSTRAINT role_assignment_property_capability_shape CHECK (
  CASE WHEN role::text IN ('pricing_editor', 'booking_mode_editor') THEN
    ((scope_type = 'project' AND project_id IS NOT NULL AND unit_id IS NULL)
      OR (scope_type = 'unit' AND project_id IS NOT NULL AND unit_id IS NOT NULL))
    AND organization_id IS NULL AND provider_id IS NULL
    AND (parent_grant_id IS NULL OR (parent_grant_id <> id AND NOT can_delegate))
    AND (expires_at IS NULL OR isfinite(expires_at))
  ELSE NOT can_delegate AND parent_grant_id IS NULL AND expires_at IS NULL END
);

CREATE FUNCTION public.guard_property_capability_parent() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE parent public.role_assignment%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role::text IN ('pricing_editor', 'booking_mode_editor')
    AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Property capability role is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.role::text NOT IN ('pricing_editor', 'booking_mode_editor') THEN RETURN NEW; END IF;
  -- A grant cannot be moved to another holder, capability, scope or ancestor.
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id OR NEW.identity_id IS DISTINCT FROM OLD.identity_id
    OR NEW.role IS DISTINCT FROM OLD.role OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
    OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
    OR NEW.parent_grant_id IS DISTINCT FROM OLD.parent_grant_id
    OR NEW.granted_by_identity_id IS DISTINCT FROM OLD.granted_by_identity_id
  ) THEN RAISE EXCEPTION 'Property capability grant provenance is immutable' USING ERRCODE = '23514'; END IF;
  -- Revocation must remain possible even when an ancestor is already revoked/expired.
  IF NEW.status::text <> 'active' OR NEW.parent_grant_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.role_assignment WHERE id = NEW.parent_grant_id FOR SHARE;
  IF NOT FOUND OR parent.status::text <> 'active' OR NOT parent.can_delegate
    OR parent.parent_grant_id IS NOT NULL OR parent.role::text <> NEW.role::text
    OR parent.identity_id = NEW.identity_id
    OR parent.identity_id IS DISTINCT FROM NEW.granted_by_identity_id
    OR parent.organization_id IS NOT NULL OR parent.provider_id IS NOT NULL
    OR parent.project_id IS DISTINCT FROM NEW.project_id
    OR NOT (parent.scope_type::text = 'project' AND parent.unit_id IS NULL
      OR parent.scope_type::text = 'unit' AND NEW.scope_type::text = 'unit' AND parent.unit_id = NEW.unit_id)
    OR parent.expires_at IS NOT NULL AND (parent.expires_at <= CURRENT_TIMESTAMP
      OR NEW.expires_at IS NULL OR NEW.expires_at > parent.expires_at)
  THEN RAISE EXCEPTION 'Invalid property capability delegation parent' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER role_assignment_property_capability_parent
  BEFORE INSERT OR UPDATE ON public.role_assignment
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_capability_parent();
COMMIT;
