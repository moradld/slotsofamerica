
-- Add chat_status column for conversation open/resolved tracking
ALTER TABLE public.ghl_conversation_logs
ADD COLUMN chat_status TEXT NOT NULL DEFAULT 'open' CHECK (chat_status IN ('open', 'resolved'));

-- Allow admins to update conversation logs (for resolving)
CREATE POLICY "Admins can update conversation logs"
ON public.ghl_conversation_logs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
