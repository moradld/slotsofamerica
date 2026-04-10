ALTER TABLE public.site_settings 
ADD COLUMN ghl_api_key TEXT DEFAULT NULL,
ADD COLUMN ghl_location_id TEXT DEFAULT NULL;