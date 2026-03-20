-- Drop old unique constraint on key alone
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;

-- Add new unique constraint on (key, tenant_id)
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_tenant_unique UNIQUE (key, tenant_id);