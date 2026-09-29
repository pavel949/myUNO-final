-- Physical structure is optional and additive. Do not infer building/floor from
-- legacy free-text unit.floor or from arbitrary resort villa numbers.
CREATE TABLE public.project_structure_node (
  id text PRIMARY KEY,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL,
  project_id text NOT NULL REFERENCES public.project(id) ON DELETE CASCADE ON UPDATE CASCADE,
  parent_id text REFERENCES public.project_structure_node(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phase','cluster','building','tower','wing','floor','block','zone','standalone')),
  code text NOT NULL,
  name text NOT NULL,
  floor_number integer,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT project_structure_node_project_id_code_key UNIQUE(project_id,code),
  CONSTRAINT project_structure_node_self_parent_check CHECK (parent_id IS NULL OR parent_id<>id),
  CONSTRAINT project_structure_node_code_check CHECK (code ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  CONSTRAINT project_structure_node_name_check CHECK (length(trim(name)) > 0)
);
CREATE INDEX project_structure_node_project_id_parent_id_sort_order_idx
  ON public.project_structure_node(project_id,parent_id,sort_order);

ALTER TABLE public.unit
  ADD COLUMN structure_node_id text;
ALTER TABLE public.unit
  ADD CONSTRAINT unit_structure_node_id_fkey FOREIGN KEY (structure_node_id)
  REFERENCES public.project_structure_node(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX unit_structure_node_id_idx ON public.unit(structure_node_id);

-- Every parent and every unit must stay inside the *same* canonical project.
-- These invariants protect writes outside the admin API (including migration).
CREATE OR REPLACE FUNCTION public.project_structure_node_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE bad_parent boolean;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent.project_id <> NEW.project_id INTO bad_parent
      FROM public.project_structure_node parent WHERE parent.id=NEW.parent_id;
    IF COALESCE(bad_parent,true) THEN
      RAISE EXCEPTION 'Physical structure parent must belong to the same project';
    END IF;
    IF EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id,parent_id FROM public.project_structure_node WHERE id=NEW.parent_id
        UNION ALL
        SELECT p.id,p.parent_id FROM public.project_structure_node p
        JOIN ancestors a ON a.parent_id=p.id
      )
      SELECT 1 FROM ancestors WHERE id=NEW.id
    ) THEN
      RAISE EXCEPTION 'Physical structure cannot contain a cycle';
    END IF;
  END IF;
  -- Reject moving a node to a different project while children/units remain.
  IF TG_OP='UPDATE' AND NEW.project_id <> OLD.project_id AND
    (EXISTS (SELECT 1 FROM public.project_structure_node WHERE parent_id=OLD.id)
      OR EXISTS (SELECT 1 FROM public.unit WHERE structure_node_id=OLD.id)) THEN
    RAISE EXCEPTION 'Cannot move occupied physical structure across projects';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_structure_node_validate_trg
  BEFORE INSERT OR UPDATE OF project_id,parent_id
  ON public.project_structure_node FOR EACH ROW
  EXECUTE FUNCTION public.project_structure_node_validate();

CREATE OR REPLACE FUNCTION public.unit_structure_project_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.structure_node_id IS NOT NULL AND
    NOT EXISTS (
      SELECT 1 FROM public.project_structure_node node
      WHERE node.id=NEW.structure_node_id AND node.project_id=NEW.project_id
    ) THEN
    RAISE EXCEPTION 'Physical unit structure must belong to the same project';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER unit_structure_project_validate_trg
  BEFORE INSERT OR UPDATE OF project_id,structure_node_id ON public.unit
  FOR EACH ROW EXECUTE FUNCTION public.unit_structure_project_validate();

ALTER TABLE public.project_structure_node ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_structure_node FROM PUBLIC, anon, authenticated;
-- Mutations are server-side only through the existing admin permission guard.
