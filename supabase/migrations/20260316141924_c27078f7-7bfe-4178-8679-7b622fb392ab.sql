-- Fix: Remove blanket SELECT policy that exposes ghl_api_key to everyone
DROP POLICY IF EXISTS "Anyone can read site settings via public view" ON public.site_settings;

-- Replace with admin-only SELECT on base table
CREATE POLICY "Only admins can read site_settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anon+authenticated to read the safe public view
-- The view already exists and excludes sensitive columns
GRANT SELECT ON public.site_settings_public TO anon, authenticated;