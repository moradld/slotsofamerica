
-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view active games" ON public.games;

CREATE POLICY "Anyone can view active games"
ON public.games
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (is_active = true);
