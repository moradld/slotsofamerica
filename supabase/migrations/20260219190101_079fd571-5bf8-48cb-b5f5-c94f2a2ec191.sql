ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS web_url text,
  ADD COLUMN IF NOT EXISTS ios_url text,
  ADD COLUMN IF NOT EXISTS android_url text;