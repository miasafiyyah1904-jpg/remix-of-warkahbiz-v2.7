
-- Lock down SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Replace public read on product-images with per-user folder scope
DROP POLICY IF EXISTS "product images public read" ON storage.objects;
CREATE POLICY "product images own read" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Make bucket private (signed URLs only)
UPDATE storage.buckets SET public = false WHERE id = 'product-images';
