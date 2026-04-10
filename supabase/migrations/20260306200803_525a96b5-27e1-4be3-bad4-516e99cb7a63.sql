
-- Fix profiles SELECT policies: change from RESTRICTIVE to PERMISSIVE
-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));
