DROP POLICY IF EXISTS "Users read own ancestor faces" ON storage.objects;
CREATE POLICY "Users read own ancestor faces" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ancestor-faces' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users upload own ancestor faces" ON storage.objects;
CREATE POLICY "Users upload own ancestor faces" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ancestor-faces' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own ancestor faces" ON storage.objects;
CREATE POLICY "Users update own ancestor faces" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ancestor-faces' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own ancestor faces" ON storage.objects;
CREATE POLICY "Users delete own ancestor faces" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ancestor-faces' AND (storage.foldername(name))[1] = auth.uid()::text);