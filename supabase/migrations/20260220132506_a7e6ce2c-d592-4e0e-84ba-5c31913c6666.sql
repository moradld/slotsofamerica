-- Add ghl_message_id column to landing_chat_messages for reliable deduplication
ALTER TABLE public.landing_chat_messages
  ADD COLUMN IF NOT EXISTS ghl_message_id TEXT DEFAULT NULL;

-- Add unique index on ghl_message_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_chat_messages_ghl_message_id
  ON public.landing_chat_messages (ghl_message_id)
  WHERE ghl_message_id IS NOT NULL;

-- Add source column to distinguish app-sent vs ghl-synced messages
ALTER TABLE public.landing_chat_messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'widget';
