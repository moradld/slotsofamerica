
-- Replace overly permissive INSERT policy with service-role-only approach
DROP POLICY "Service can insert conversation logs" ON public.ghl_conversation_logs;

-- Only admins or the system (via service role) can insert
CREATE POLICY "Admins and system can insert conversation logs"
ON public.ghl_conversation_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
