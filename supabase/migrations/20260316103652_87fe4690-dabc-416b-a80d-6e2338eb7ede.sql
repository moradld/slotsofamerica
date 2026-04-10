
-- 1. Restrict transaction INSERT so users can only create with status='pending'
DROP POLICY IF EXISTS "Users create own transactions" ON public.transactions;
CREATE POLICY "Users create own transactions"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- 2. Restrict rewards_config SELECT for regular users to active rows only
DROP POLICY IF EXISTS "Authenticated users can read rewards config" ON public.rewards_config;
CREATE POLICY "Authenticated users can read active rewards config"
  ON public.rewards_config
  FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
