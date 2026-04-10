
-- FIX 1: Profiles - tighten UPDATE policy to block sensitive columns via WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND balance IS NOT DISTINCT FROM (SELECT balance FROM public.profiles WHERE id = auth.uid())
    AND email_verified IS NOT DISTINCT FROM (SELECT email_verified FROM public.profiles WHERE id = auth.uid())
    AND phone_verified IS NOT DISTINCT FROM (SELECT phone_verified FROM public.profiles WHERE id = auth.uid())
    AND email_verified_at IS NOT DISTINCT FROM (SELECT email_verified_at FROM public.profiles WHERE id = auth.uid())
    AND phone_verified_at IS NOT DISTINCT FROM (SELECT phone_verified_at FROM public.profiles WHERE id = auth.uid())
    AND email_verified_by_admin IS NOT DISTINCT FROM (SELECT email_verified_by_admin FROM public.profiles WHERE id = auth.uid())
  );

-- FIX 2: Revoke SELECT on password_hash column from authenticated users
REVOKE SELECT ON public.game_accounts FROM authenticated;
-- Re-grant SELECT without password_hash by using the view only
-- Users should use game_accounts_user view instead

-- FIX 3: Drop and recreate game_accounts_user view with proper security
DROP VIEW IF EXISTS public.game_accounts_user;
CREATE VIEW public.game_accounts_user 
WITH (security_invoker = on) AS
SELECT id, game_id, username, status, assigned_to, created_at, updated_at
FROM public.game_accounts
WHERE assigned_to = auth.uid();

GRANT SELECT ON public.game_accounts_user TO authenticated;
