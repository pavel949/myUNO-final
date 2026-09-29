-- Add the missing media scope: Project → InventoryCategory → Unit.
-- Gallery links never duplicate image bytes; a MediaAsset can be reused by
-- the project, room/villa category and physical unit without shared ordering.
ALTER TABLE public.inventory_category
  ADD COLUMN IF NOT EXISTS cover_media_id text;
ALTER TABLE public.inventory_category
  ADD CONSTRAINT inventory_category_cover_media_id_fkey
  FOREIGN KEY (cover_media_id) REFERENCES public.media_asset(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE IF NOT EXISTS public.inventory_category_media (
  category_id text NOT NULL REFERENCES public.inventory_category(id) ON DELETE CASCADE ON UPDATE CASCADE,
  media_id text NOT NULL REFERENCES public.media_asset(id) ON DELETE CASCADE ON UPDATE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id,media_id)
);
CREATE INDEX IF NOT EXISTS inventory_category_media_sort_idx
  ON public.inventory_category_media(category_id,sort);
ALTER TABLE public.inventory_category_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_category_media FROM PUBLIC, anon, authenticated;
-- The authenticated admin API uses server-side scoped authorization. The
-- table is intentionally NOT exposed through the Supabase Data API.
