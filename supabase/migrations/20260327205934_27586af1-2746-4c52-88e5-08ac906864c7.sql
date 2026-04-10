
-- Add SELECT policy for admins to see ALL games (including inactive)
CREATE POLICY "Admins can view all games"
ON public.games FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add SELECT policy for managers to see ALL games
CREATE POLICY "Managers can view all games"
ON public.games FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Add UPDATE policy for managers
CREATE POLICY "Managers can update games"
ON public.games FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));
