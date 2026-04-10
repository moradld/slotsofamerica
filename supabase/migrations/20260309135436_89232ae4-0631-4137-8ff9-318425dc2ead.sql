
-- Drop existing RESTRICTIVE SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can view own profile" ON public.profiles
AS PERMISSIVE FOR SELECT TO public
USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all profiles" ON public.profiles
AS PERMISSIVE FOR SELECT TO public
USING (has_role(auth.uid(), 'manager'::app_role));
