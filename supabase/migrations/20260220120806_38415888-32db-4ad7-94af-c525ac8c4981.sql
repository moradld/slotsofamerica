
-- Table for anonymous landing page visitor chat sessions
CREATE TABLE public.landing_chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_token text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  ghl_contact_id text,
  ghl_conversation_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a new session (anonymous visitors)
CREATE POLICY "Anyone can create landing chat session"
  ON public.landing_chat_sessions FOR INSERT
  WITH CHECK (true);

-- Visitors can read/update their own session by token (enforced in edge function, not user-auth based)
CREATE POLICY "Anyone can read landing chat sessions"
  ON public.landing_chat_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update their landing chat session"
  ON public.landing_chat_sessions FOR UPDATE
  USING (true);

-- Admins can see all sessions
CREATE POLICY "Admins can delete landing chat sessions"
  ON public.landing_chat_sessions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for storing messages for landing page visitors
CREATE TABLE public.landing_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.landing_chat_sessions(id) ON DELETE CASCADE,
  body text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound', -- inbound = visitor, outbound = support
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert landing chat messages"
  ON public.landing_chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read landing chat messages"
  ON public.landing_chat_messages FOR SELECT
  USING (true);
