
-- Create storage bucket for payment gateway QR codes
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-gateway-qr', 'payment-gateway-qr', true);

-- Public read access
CREATE POLICY "Anyone can view QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-gateway-qr');

-- Only admins can upload/update/delete QR codes
CREATE POLICY "Admins can upload QR codes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update QR codes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete QR codes"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-gateway-qr' AND has_role(auth.uid(), 'admin'::app_role));
