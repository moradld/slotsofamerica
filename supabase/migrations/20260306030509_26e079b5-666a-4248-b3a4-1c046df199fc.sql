-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_status_type ON public.transactions (status, type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_game_accounts_game_assigned ON public.game_accounts (game_id, status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_game_unlock_requests_user_game ON public.game_unlock_requests (user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_game_unlock_requests_status ON public.game_unlock_requests (status);
CREATE INDEX IF NOT EXISTS idx_password_requests_status ON public.password_requests (status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_txn ON public.transaction_logs (transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits (user_id, action, created_at);