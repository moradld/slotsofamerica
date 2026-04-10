
-- Create app_settings table for secure API key storage
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Only admins can read app_settings"
ON public.app_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Only admins can insert app_settings"
ON public.app_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Only admins can update app_settings"
ON public.app_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Only admins can delete app_settings"
ON public.app_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp trigger
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial GHL keys from existing site_settings (migrate data)
INSERT INTO public.app_settings (key, value)
SELECT 'GHL_API_KEY', COALESCE(ghl_api_key, '')
FROM public.site_settings
LIMIT 1
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
SELECT 'GHL_LOCATION_ID', COALESCE(ghl_location_id, '')
FROM public.site_settings
LIMIT 1
ON CONFLICT (key) DO NOTHING;
