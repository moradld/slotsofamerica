-- Add GHL conversation assignment settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS ghl_conversation_mode text NOT NULL DEFAULT 'support',
ADD COLUMN IF NOT EXISTS ghl_assigned_user_id text DEFAULT NULL;