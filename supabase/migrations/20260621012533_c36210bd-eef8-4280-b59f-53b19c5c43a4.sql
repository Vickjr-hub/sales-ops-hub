
DROP POLICY IF EXISTS "Authenticated can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Authenticated can insert webhook logs"
  ON public.webhook_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
