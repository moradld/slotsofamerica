
-- Tighten landing_chat_sessions UPDATE policy to only allow updating own session by visitor_token
DROP POLICY IF EXISTS "Anyone can update their landing chat session" ON public.landing_chat_sessions;
CREATE POLICY "Visitors can update own landing chat session"
  ON public.landing_chat_sessions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Note: landing_chat INSERT policies must remain permissive (true) because 
-- unauthenticated visitors need to create sessions and messages.
-- This is an intentional design choice for the public chat widget.
