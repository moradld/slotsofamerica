-- Create storage bucket for game images
INSERT INTO storage.buckets (id, name, public) VALUES ('game-images', 'game-images', true);

-- Allow anyone to view game images
CREATE POLICY "Game images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-images');

-- Allow admins to upload game images
CREATE POLICY "Admins can upload game images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update game images
CREATE POLICY "Admins can update game images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'game-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete game images
CREATE POLICY "Admins can delete game images"
ON storage.objects FOR DELETE
USING (bucket_id = 'game-images' AND has_role(auth.uid(), 'admin'::app_role));