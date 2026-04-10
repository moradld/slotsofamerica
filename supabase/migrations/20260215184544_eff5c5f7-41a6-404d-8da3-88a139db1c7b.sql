
-- Table to track active GHL conversations per user (for in-app chat)
CREATE TABLE public.ghl_user_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  transaction_type TEXT NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_ghl_user_conv_user_id ON public.ghl_user_conversations(user_id);
CREATE INDEX idx_ghl_user_conv_conversation_id ON public.ghl_user_conversations(conversation_id);
CREATE INDEX idx_ghl_user_conv_open ON public.ghl_user_conversations(user_id, is_open) WHERE is_open = true;

-- Enable RLS
ALTER TABLE public.ghl_user_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
ON public.ghl_user_conversations FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
ON public.ghl_user_conversations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts (from edge function)
CREATE POLICY "Service can insert conversations"
ON public.ghl_user_conversations FOR INSERT
WITH CHECK (true);

-- Service role updates
CREATE POLICY "Service can update conversations"
ON public.ghl_user_conversations FOR UPDATE
USING (true);
