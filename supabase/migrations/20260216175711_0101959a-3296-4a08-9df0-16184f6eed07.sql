
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS twilio_account_sid text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS twilio_auth_token text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS twilio_phone_number text;
