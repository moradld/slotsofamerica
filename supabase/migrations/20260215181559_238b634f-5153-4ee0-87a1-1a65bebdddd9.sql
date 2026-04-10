
-- Table to log GHL transaction conversations
CREATE TABLE public.ghl_conversation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id TEXT,
  conversation_id TEXT,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  game_name TEXT,
  game_username TEXT,
  message_body TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  assigned_to TEXT,
  conversation_mode TEXT DEFAULT 'support',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ghl_conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversation logs"
ON public.ghl_conversation_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert conversation logs"
ON public.ghl_conversation_logs FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_ghl_conv_logs_created ON public.ghl_conversation_logs(created_at DESC);
CREATE INDEX idx_ghl_conv_logs_user ON public.ghl_conversation_logs(user_id);
