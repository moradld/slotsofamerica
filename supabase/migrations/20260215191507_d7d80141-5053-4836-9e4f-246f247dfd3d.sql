
-- Create chat_messages table for local messaging (works with or without GHL)
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_log_id UUID REFERENCES public.ghl_conversation_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own messages
CREATE POLICY "Users can view their own chat messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages (inbound only)
CREATE POLICY "Users can send chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id AND direction = 'inbound');

-- Admins can read all and insert outbound messages
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can send outbound messages"
ON public.chat_messages FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_chat_messages_conv_log ON public.chat_messages(conversation_log_id);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
