
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS groupme_webhook_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  webhook_url text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Authenticated can insert webhook logs"
  ON public.webhook_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can view webhook logs" ON public.webhook_logs;
CREATE POLICY "Owners can view webhook logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
