-- Remove the user SELECT policy from game_accounts base table
DROP POLICY IF EXISTS "Users view own assigned accounts via view" ON public.game_accounts;

-- Drop the view entirely
DROP VIEW IF EXISTS public.game_accounts_user;

-- Create a security definer function that returns game account data without password_hash
CREATE OR REPLACE FUNCTION public.get_my_game_accounts()
RETURNS TABLE (
  id uuid,
  game_id uuid,
  username text,
  assigned_to uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ga.id, ga.game_id, ga.username, ga.assigned_to, ga.status, ga.created_at, ga.updated_at
  FROM public.game_accounts ga
  WHERE ga.assigned_to = auth.uid()
$$;

-- Recreate the view using the function so it doesn't need RLS at all
CREATE VIEW public.game_accounts_user AS
SELECT * FROM public.get_my_game_accounts();