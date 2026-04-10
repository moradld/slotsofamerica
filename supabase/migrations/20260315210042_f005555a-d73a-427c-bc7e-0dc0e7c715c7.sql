-- Drop the security definer view - the function alone is sufficient
DROP VIEW IF EXISTS public.game_accounts_user;

-- The get_my_game_accounts() function is the safe access layer
-- It uses SECURITY DEFINER to bypass RLS and filters by auth.uid()
-- No password_hash is returned