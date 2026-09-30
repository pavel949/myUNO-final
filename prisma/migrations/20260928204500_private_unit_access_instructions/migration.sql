CREATE TABLE IF NOT EXISTS public.unit_access_instruction (
 unit_id text PRIMARY KEY REFERENCES public.unit(id) ON DELETE CASCADE,
 ciphertext text NOT NULL,
 updated_by_identity_id text NOT NULL REFERENCES public.identity(id),
 updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.unit_access_instruction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_access_instruction FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.unit_access_instruction IS 'Only server-side encrypted access instructions: never expose through public listing queries.';