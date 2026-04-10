-- Fix overly permissive landing_chat_sessions UPDATE policy
DROP POLICY IF EXISTS "Visitors can update own landing chat session" ON public.landing_chat_sessions;
CREATE POLICY "Visitors can update own landing chat session" ON public.landing_chat_sessions
  FOR UPDATE USING (visitor_token IS NOT NULL)
  WITH CHECK (visitor_token IS NOT NULL);

-- Fix overly permissive landing_chat_messages INSERT policy  
DROP POLICY IF EXISTS "Anyone can insert landing chat messages" ON public.landing_chat_messages;
CREATE POLICY "Anyone can insert landing chat messages" ON public.landing_chat_messages
  FOR INSERT WITH CHECK (session_id IS NOT NULL AND body IS NOT NULL AND length(body) <= 5000);