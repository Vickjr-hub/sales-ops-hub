
CREATE POLICY "sale photos: upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sale-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sale photos: read own or owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sale-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'owner')));
CREATE POLICY "sale photos: delete own or owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sale-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'owner')));
