
-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_accounts_game_id_status ON public.game_accounts(game_id, status);
CREATE INDEX IF NOT EXISTS idx_game_accounts_assigned_to ON public.game_accounts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_game_unlock_requests_user_game ON public.game_unlock_requests(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_game_unlock_requests_status ON public.game_unlock_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_requests_status ON public.password_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_requests_user_id ON public.password_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_transaction_id ON public.transaction_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON public.email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON public.phone_verifications(user_id);

-- Prevent negative balances via validation trigger
CREATE OR REPLACE FUNCTION public.prevent_negative_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_balance_not_negative ON public.profiles;
CREATE TRIGGER check_balance_not_negative
  BEFORE UPDATE OF balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_negative_balance();
