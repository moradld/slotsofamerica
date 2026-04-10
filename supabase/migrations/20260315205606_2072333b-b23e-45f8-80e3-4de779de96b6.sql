-- Drop the user-facing SELECT policy on game_accounts that exposes password_hash
DROP POLICY IF EXISTS "Users view assigned accounts" ON public.game_accounts;

-- Add RLS policy on game_accounts_user view so users can only see their own assigned accounts
-- First, enable RLS on the view (if not already)
ALTER VIEW public.game_accounts_user SET (security_invoker = true);

-- Create a policy on the base table that restricts user SELECT to the view columns only
-- Since views inherit base table RLS, we need to ensure users query through the view instead.
-- The game_accounts_user view already excludes password_hash, so we just need users to use it.
-- By removing the direct SELECT policy, users can no longer query game_accounts directly.
-- The view uses security_invoker so it inherits the caller's permissions.
-- We need a SELECT policy that works ONLY through the view context.

-- Actually, since game_accounts_user is a view that selects from game_accounts,
-- and we removed the user SELECT policy, the view won't work either.
-- We need to make the view SECURITY DEFINER instead.

-- Recreate the view as security definer (owner context) so it bypasses RLS
DROP VIEW IF EXISTS public.game_accounts_user;
CREATE VIEW public.game_accounts_user
WITH (security_barrier = true)
AS
SELECT id, game_id, username, assigned_to, status, created_at, updated_at
FROM public.game_accounts;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.game_accounts_user TO authenticated;
GRANT SELECT ON public.game_accounts_user TO anon;

-- Add RLS-like filtering via the view by making it filter by user
DROP VIEW IF EXISTS public.game_accounts_user;
CREATE VIEW public.game_accounts_user
WITH (security_barrier = true)
AS
SELECT id, game_id, username, assigned_to, status, created_at, updated_at
FROM public.game_accounts
WHERE assigned_to = auth.uid();

GRANT SELECT ON public.game_accounts_user TO authenticated;