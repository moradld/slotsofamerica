
-- Migrate Resend API key from site_settings to app_settings
INSERT INTO public.app_settings (key, value)
SELECT 'RESEND_API_KEY', COALESCE(resend_api_key, '')
FROM public.site_settings
LIMIT 1
ON CONFLICT (key) DO NOTHING;
