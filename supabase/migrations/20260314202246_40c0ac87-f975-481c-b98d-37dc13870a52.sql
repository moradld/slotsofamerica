ALTER TABLE public.verification_settings
  ADD COLUMN IF NOT EXISTS smtp_host text DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 465,
  ADD COLUMN IF NOT EXISTS smtp_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_password text DEFAULT '';