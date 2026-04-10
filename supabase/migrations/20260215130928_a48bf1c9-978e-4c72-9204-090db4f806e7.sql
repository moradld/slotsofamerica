-- Add landing page configuration JSON column to site_settings
ALTER TABLE public.site_settings
ADD COLUMN landing_page_config jsonb DEFAULT '{}'::jsonb;