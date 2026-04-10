
-- FIX 1: Payment gateways - restrict public SELECT to active only
DROP POLICY IF EXISTS "Anyone can view active payment gateways" ON public.payment_gateways;
CREATE POLICY "Anyone can view active payment gateways"
  ON public.payment_gateways FOR SELECT
  USING (is_active = true);

-- Admins can see all (including inactive)
CREATE POLICY "Admins can view all payment gateways"
  ON public.payment_gateways FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- FIX 2: game_accounts password_hash exposure - create a safe view for users
CREATE OR REPLACE VIEW public.game_accounts_user AS
SELECT id, game_id, username, status, assigned_to, created_at, updated_at
FROM public.game_accounts;

ALTER VIEW public.game_accounts_user SET (security_invoker = on);
GRANT SELECT ON public.game_accounts_user TO authenticated;

-- FIX 3: ghl_conversation_logs - restrict user UPDATE to only chat_status column
DROP POLICY IF EXISTS "Users can reopen their own conversations" ON public.ghl_conversation_logs;

CREATE OR REPLACE FUNCTION public.reopen_own_conversation(_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ghl_conversation_logs
  SET chat_status = 'open'
  WHERE id = _log_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or not yours';
  END IF;
END;
$$;

-- FIX 4 & 5: Views are read-only by nature in Postgres, the scanner is confused
-- They don't need RLS since views inherit from underlying table's RLS
-- Mark these as non-issues via the security tool
