-- Add user_id column to landing_chat_sessions to link anonymous visitors to registered users
ALTER TABLE public.landing_chat_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid NULL;

-- Index for efficient lookups by user
CREATE INDEX IF NOT EXISTS idx_landing_chat_sessions_user_id
  ON public.landing_chat_sessions (user_id);
