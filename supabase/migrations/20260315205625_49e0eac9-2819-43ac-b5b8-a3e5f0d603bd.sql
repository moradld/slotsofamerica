-- Fix: Switch view to security_invoker and add a limited RLS policy back
DROP VIEW IF EXISTS public.game_accounts_user;

CREATE VIEW public.game_accounts_user
WITH (security_invoker = true, security_barrier = true)
AS
SELECT id, game_id, username, assigned_to, status, created_at, updated_at
FROM public.game_accounts;

GRANT SELECT ON public.game_accounts_user TO authenticated;

-- Re-add a user SELECT policy on game_accounts but ONLY for the columns in the view
-- Since we can't restrict columns in RLS, we use the view as the access layer.
-- The policy allows users to select their own rows (needed for the view to work)
CREATE POLICY "Users view own assigned accounts via view"
  ON public.game_accounts
  FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());