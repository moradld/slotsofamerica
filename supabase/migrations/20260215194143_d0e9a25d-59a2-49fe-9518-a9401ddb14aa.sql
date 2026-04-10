CREATE POLICY "Users can reopen their own conversations"
ON public.ghl_conversation_logs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);