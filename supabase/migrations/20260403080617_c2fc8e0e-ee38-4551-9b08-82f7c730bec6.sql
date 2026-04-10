
-- Managers can upload to payment-gateway-qr
CREATE POLICY "Managers can upload QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can update in payment-gateway-qr
CREATE POLICY "Managers can update QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete from payment-gateway-qr
CREATE POLICY "Managers can delete QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can upload game images
CREATE POLICY "Managers can upload game images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can update game images
CREATE POLICY "Managers can update game images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images' AND has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete game images
CREATE POLICY "Managers can delete game images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'game-images' AND has_role(auth.uid(), 'manager'::app_role));
