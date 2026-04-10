
-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.site_settings_public SET (security_invoker = on);
ALTER VIEW public.verification_settings_public SET (security_invoker = on);

-- Fix the permissive landing chat session UPDATE policy
DROP POLICY IF EXISTS "Owner can update own landing chat session" ON public.landing_chat_sessions;
-- No UPDATE policy needed since the widget only creates sessions, not updates them
