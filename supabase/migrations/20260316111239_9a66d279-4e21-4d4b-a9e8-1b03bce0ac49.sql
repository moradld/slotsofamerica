
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flagged_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flagged_reason text;
