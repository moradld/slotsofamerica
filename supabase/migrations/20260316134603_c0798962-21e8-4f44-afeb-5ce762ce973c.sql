-- Allow anyone (including anon) to read site_settings for the public view
CREATE POLICY "Anyone can read site settings via public view"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Drop the admin-only select policy since the new one covers it
DROP POLICY IF EXISTS "Admins can read all site settings" ON public.site_settings;