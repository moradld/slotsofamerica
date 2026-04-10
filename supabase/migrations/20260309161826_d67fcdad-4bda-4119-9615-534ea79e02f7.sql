ALTER TABLE public.site_settings DROP COLUMN IF EXISTS resend_api_key;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS resend_from_email;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS twilio_account_sid;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS twilio_auth_token;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS twilio_phone_number;