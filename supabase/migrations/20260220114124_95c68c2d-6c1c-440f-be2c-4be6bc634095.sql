ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS telegram_link text NULL,
  ADD COLUMN IF NOT EXISTS messenger_link text NULL;