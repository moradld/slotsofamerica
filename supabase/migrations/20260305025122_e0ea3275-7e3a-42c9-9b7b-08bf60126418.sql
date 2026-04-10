-- =============================================
-- FIX ALL RESTRICTIVE RLS POLICIES → PERMISSIVE
-- =============================================

-- 1. app_settings
DROP POLICY IF EXISTS "Only admins can delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can update app_settings" ON public.app_settings;
CREATE POLICY "Only admins can delete app_settings" ON public.app_settings FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can read app_settings" ON public.app_settings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can update app_settings" ON public.app_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. audit_logs
DROP POLICY IF EXISTS "Managers can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Managers can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can view audit logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 3. chat_messages
DROP POLICY IF EXISTS "Admins can send outbound messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can view all chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Admins can view all chat messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can send outbound messages" ON public.chat_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can send chat messages" ON public.chat_messages FOR INSERT WITH CHECK ((auth.uid() = user_id) AND (direction = 'inbound'::text));

-- 4. email_templates
DROP POLICY IF EXISTS "Admins can delete email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can view email templates" ON public.email_templates;
CREATE POLICY "Admins can delete email templates" ON public.email_templates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert email templates" ON public.email_templates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update email templates" ON public.email_templates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view email templates" ON public.email_templates FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. game_accounts
DROP POLICY IF EXISTS "Admins delete accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Admins manage accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Admins update accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Admins view all accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Managers update game accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Managers view game accounts" ON public.game_accounts;
DROP POLICY IF EXISTS "Users view assigned accounts" ON public.game_accounts;
CREATE POLICY "Admins delete accounts" ON public.game_accounts FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage accounts" ON public.game_accounts FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update accounts" ON public.game_accounts FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all accounts" ON public.game_accounts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers update game accounts" ON public.game_accounts FOR UPDATE USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers view game accounts" ON public.game_accounts FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users view assigned accounts" ON public.game_accounts FOR SELECT USING (assigned_to = auth.uid());

-- 6. game_unlock_requests
DROP POLICY IF EXISTS "Admins can update requests" ON public.game_unlock_requests;
DROP POLICY IF EXISTS "Managers can update requests" ON public.game_unlock_requests;
DROP POLICY IF EXISTS "Managers can view requests" ON public.game_unlock_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON public.game_unlock_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.game_unlock_requests;
CREATE POLICY "Admins can update requests" ON public.game_unlock_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can update requests" ON public.game_unlock_requests FOR UPDATE USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers can view requests" ON public.game_unlock_requests FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users can insert own requests" ON public.game_unlock_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view own requests" ON public.game_unlock_requests FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 7. games
DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
DROP POLICY IF EXISTS "Admins can insert games" ON public.games;
DROP POLICY IF EXISTS "Admins can update games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view active games" ON public.games;
CREATE POLICY "Admins can delete games" ON public.games FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert games" ON public.games FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update games" ON public.games FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active games" ON public.games FOR SELECT USING (is_active = true);

-- 8. ghl_conversation_logs
DROP POLICY IF EXISTS "Admins and system can insert conversation logs" ON public.ghl_conversation_logs;
DROP POLICY IF EXISTS "Admins can update conversation logs" ON public.ghl_conversation_logs;
DROP POLICY IF EXISTS "Admins can view conversation logs" ON public.ghl_conversation_logs;
DROP POLICY IF EXISTS "Users can reopen their own conversations" ON public.ghl_conversation_logs;
CREATE POLICY "Admins can insert conversation logs" ON public.ghl_conversation_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update conversation logs" ON public.ghl_conversation_logs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view conversation logs" ON public.ghl_conversation_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own conversation logs" ON public.ghl_conversation_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can reopen their own conversations" ON public.ghl_conversation_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. ghl_user_conversations
DROP POLICY IF EXISTS "Admins can insert conversations" ON public.ghl_user_conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON public.ghl_user_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.ghl_user_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ghl_user_conversations;
CREATE POLICY "Admins can insert conversations" ON public.ghl_user_conversations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update conversations" ON public.ghl_user_conversations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all conversations" ON public.ghl_user_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own conversations" ON public.ghl_user_conversations FOR SELECT USING (auth.uid() = user_id);

-- 10. landing_chat_messages
DROP POLICY IF EXISTS "Anyone can insert landing chat messages" ON public.landing_chat_messages;
DROP POLICY IF EXISTS "Anyone can read landing chat messages" ON public.landing_chat_messages;
CREATE POLICY "Anyone can insert landing chat messages" ON public.landing_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read landing chat messages" ON public.landing_chat_messages FOR SELECT USING (true);

-- 11. landing_chat_sessions
DROP POLICY IF EXISTS "Admins can delete landing chat sessions" ON public.landing_chat_sessions;
DROP POLICY IF EXISTS "Anyone can create landing chat session" ON public.landing_chat_sessions;
DROP POLICY IF EXISTS "Anyone can read landing chat sessions" ON public.landing_chat_sessions;
DROP POLICY IF EXISTS "Anyone can update their landing chat session" ON public.landing_chat_sessions;
CREATE POLICY "Admins can delete landing chat sessions" ON public.landing_chat_sessions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can create landing chat session" ON public.landing_chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read landing chat sessions" ON public.landing_chat_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can update their landing chat session" ON public.landing_chat_sessions FOR UPDATE USING (true);

-- 12. notifications
DROP POLICY IF EXISTS "Admins create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers create notifications" ON public.notifications FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

-- 13. password_requests
DROP POLICY IF EXISTS "Admins update pw requests" ON public.password_requests;
DROP POLICY IF EXISTS "Managers update password requests" ON public.password_requests;
DROP POLICY IF EXISTS "Managers view password requests" ON public.password_requests;
DROP POLICY IF EXISTS "Users create pw requests" ON public.password_requests;
DROP POLICY IF EXISTS "Users view own pw requests" ON public.password_requests;
CREATE POLICY "Admins update pw requests" ON public.password_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers update password requests" ON public.password_requests FOR UPDATE USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers view password requests" ON public.password_requests FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users create pw requests" ON public.password_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own pw requests" ON public.password_requests FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 14. payment_gateways
DROP POLICY IF EXISTS "Admins can delete payment gateways" ON public.payment_gateways;
DROP POLICY IF EXISTS "Admins can insert payment gateways" ON public.payment_gateways;
DROP POLICY IF EXISTS "Admins can update payment gateways" ON public.payment_gateways;
DROP POLICY IF EXISTS "Anyone can view active payment gateways" ON public.payment_gateways;
CREATE POLICY "Admins can delete payment gateways" ON public.payment_gateways FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert payment gateways" ON public.payment_gateways FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update payment gateways" ON public.payment_gateways FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active payment gateways" ON public.payment_gateways FOR SELECT USING (true);

-- 15. phone_verifications
DROP POLICY IF EXISTS "Users can insert own verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON public.phone_verifications;
CREATE POLICY "Users can insert own verifications" ON public.phone_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own verifications" ON public.phone_verifications FOR SELECT USING (auth.uid() = user_id);

-- 16. rate_limits - keep as restrictive (intentionally blocks all direct access)
-- No changes needed

-- 17. rewards_config
DROP POLICY IF EXISTS "Admins can manage rewards config" ON public.rewards_config;
DROP POLICY IF EXISTS "Authenticated users can read rewards config" ON public.rewards_config;
CREATE POLICY "Admins can manage rewards config" ON public.rewards_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read rewards config" ON public.rewards_config FOR SELECT USING (auth.uid() IS NOT NULL);

-- 18. site_settings
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);

-- 19. transaction_logs
DROP POLICY IF EXISTS "Managers can insert transaction logs" ON public.transaction_logs;
DROP POLICY IF EXISTS "Managers can view transaction logs" ON public.transaction_logs;
DROP POLICY IF EXISTS "Only admins can insert transaction logs" ON public.transaction_logs;
DROP POLICY IF EXISTS "Only admins can view transaction logs" ON public.transaction_logs;
CREATE POLICY "Admins can view transaction logs" ON public.transaction_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can view transaction logs" ON public.transaction_logs FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins can insert transaction logs" ON public.transaction_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can insert transaction logs" ON public.transaction_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 20. transactions
DROP POLICY IF EXISTS "Admins update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Managers update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Managers view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users create own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
CREATE POLICY "Admins update transactions" ON public.transactions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers update transactions" ON public.transactions FOR UPDATE USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers view all transactions" ON public.transactions FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users create own transactions" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));