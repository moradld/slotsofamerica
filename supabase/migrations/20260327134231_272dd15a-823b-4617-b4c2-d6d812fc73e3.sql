-- Allow authenticated users to upload to deposit-proofs
CREATE POLICY "Authenticated users can upload deposit proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deposit-proofs');

-- Allow anyone to view deposit proofs (bucket is public)
CREATE POLICY "Anyone can view deposit proofs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'deposit-proofs');

-- Only admins can delete deposit proofs
CREATE POLICY "Only admins can delete deposit proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'deposit-proofs' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update deposit proofs
CREATE POLICY "Only admins can update deposit proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'deposit-proofs' AND public.has_role(auth.uid(), 'admin'));