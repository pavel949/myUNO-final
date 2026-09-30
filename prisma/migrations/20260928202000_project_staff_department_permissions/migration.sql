CREATE TABLE IF NOT EXISTS public.project_staff_permission (
 project_id text NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
 identity_id text NOT NULL REFERENCES public.identity(id) ON DELETE CASCADE,
 departments text[] NOT NULL DEFAULT ARRAY[]::text[],
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(project_id,identity_id),
 CONSTRAINT project_staff_departments_valid CHECK (departments <@ ARRAY[
  'reservations','front_desk','housekeeping','maintenance','guest_care','finance','pricing','content','channels','owner_relations'
 ]::text[])
);
CREATE INDEX IF NOT EXISTS project_staff_permission_identity_idx ON public.project_staff_permission(identity_id);
ALTER TABLE public.project_staff_permission ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_staff_permission FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.project_staff_permission IS 'Server-only per-project staff grants; an active role_assignment remains mandatory.';