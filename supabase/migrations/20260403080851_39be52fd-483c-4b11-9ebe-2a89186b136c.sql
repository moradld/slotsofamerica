
-- Managers can upload to brand-assets
CREATE POLICY "Managers can upload brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can update in brand-assets
CREATE POLICY "Managers can update brand assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete from brand-assets
CREATE POLICY "Managers can delete brand assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can view brand-assets
CREATE POLICY "Managers can view brand assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'manager'::app_role));
