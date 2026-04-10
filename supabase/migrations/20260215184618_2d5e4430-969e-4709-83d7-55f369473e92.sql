
-- Tighten INSERT policy: only admins or service role can insert
DROP POLICY "Service can insert conversations" ON public.ghl_user_conversations;
CREATE POLICY "Admins can insert conversations"
ON public.ghl_user_conversations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tighten UPDATE policy: only admins or service role can update
DROP POLICY "Service can update conversations" ON public.ghl_user_conversations;
CREATE POLICY "Admins can update conversations"
ON public.ghl_user_conversations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
