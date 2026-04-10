-- Fix overly permissive landing_chat_sessions INSERT policy
DROP POLICY IF EXISTS "Anyone can create landing chat session" ON public.landing_chat_sessions;
CREATE POLICY "Anyone can create landing chat session" ON public.landing_chat_sessions
  FOR INSERT WITH CHECK (visitor_token IS NOT NULL AND name IS NOT NULL AND length(name) <= 200);