-- Protective-only source calendar synchronization while Layantara remains authoritative.
UPDATE public.external_system SET
 config=config||'{"protectionEnabled":true,"bookingAuthority":"source","cutoverVerified":false}'::jsonb,
 updated_at=now()
WHERE system_key='layantara_os' AND status='staging';
