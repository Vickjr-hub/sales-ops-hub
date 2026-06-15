ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_value numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
  CHECK (status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Activated'::text, 'Rejected'::text]));

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS rep_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS sale_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS activation_date date,
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.payroll_entries
  ADD CONSTRAINT payroll_entries_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_entries_sale_id_key
  ON public.payroll_entries (sale_id) WHERE sale_id IS NOT NULL;

ALTER TABLE public.payroll_entries DROP CONSTRAINT IF EXISTS payroll_entries_product_type_check;
ALTER TABLE public.payroll_entries ADD CONSTRAINT payroll_entries_product_type_check
  CHECK (product_type IS NULL OR product_type = ANY (ARRAY['phone_line'::text, 'internet'::text, 'directv'::text]));
ALTER TABLE public.payroll_entries DROP CONSTRAINT IF EXISTS payroll_entries_status_check;
ALTER TABLE public.payroll_entries ADD CONSTRAINT payroll_entries_status_check
  CHECK (status IS NULL OR status = 'pending_payout'::text);

REVOKE INSERT, UPDATE, DELETE ON public.payroll_entries FROM authenticated;
GRANT SELECT ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;

DROP POLICY IF EXISTS "owners manage payroll" ON public.payroll_entries;
CREATE POLICY "owners view payroll"
ON public.payroll_entries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.process_sale_status(
  _sale_id uuid,
  _new_status text
)
RETURNS public.payroll_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_rate numeric(12,2);
  v_commission numeric(12,2);
  v_rep_name text;
  v_product_type text := 'phone_line';
  v_result public.payroll_entries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Owner access is required';
  END IF;

  IF _new_status NOT IN ('Approved', 'Activated') THEN
    RAISE EXCEPTION 'Status must be Approved or Activated';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = _sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  SELECT COALESCE(phone_line_rate, 200)
  INTO v_rate
  FROM public.settings
  ORDER BY id
  LIMIT 1;
  v_rate := COALESCE(v_rate, 200);
  v_commission := COALESCE(v_sale.lines, 0) * v_rate;

  SELECT COALESCE(NULLIF(full_name, ''), 'Representative')
  INTO v_rep_name
  FROM public.profiles
  WHERE id = v_sale.rep_id;
  v_rep_name := COALESCE(v_rep_name, 'Representative');

  UPDATE public.sales
  SET status = _new_status,
      activation_status = CASE WHEN _new_status = 'Activated' THEN 'Activated' ELSE activation_status END,
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = _sale_id
  RETURNING * INTO v_sale;

  INSERT INTO public.payroll_entries (
    sale_id, rep_id, owner_id, commission_amount, product_type, sale_value,
    activation_date, status, rep_name, raw_lines, activated_lines,
    internet_sales, directv_sales, gross_commission,
    pay_period_start, pay_period_end
  ) VALUES (
    v_sale.id, v_sale.rep_id, auth.uid(), v_commission, v_product_type,
    v_sale.sale_value, CASE WHEN _new_status = 'Activated' THEN CURRENT_DATE ELSE NULL END,
    'pending_payout', v_rep_name, v_sale.lines,
    CASE WHEN _new_status = 'Activated' THEN v_sale.lines ELSE 0 END,
    0, 0, v_commission,
    date_trunc('week', v_sale.sale_date::timestamp)::date,
    (date_trunc('week', v_sale.sale_date::timestamp)::date + 6)
  )
  ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL DO UPDATE SET
    rep_id = EXCLUDED.rep_id,
    owner_id = EXCLUDED.owner_id,
    commission_amount = EXCLUDED.commission_amount,
    product_type = EXCLUDED.product_type,
    sale_value = EXCLUDED.sale_value,
    activation_date = COALESCE(EXCLUDED.activation_date, public.payroll_entries.activation_date),
    status = 'pending_payout',
    rep_name = EXCLUDED.rep_name,
    raw_lines = EXCLUDED.raw_lines,
    activated_lines = CASE WHEN _new_status = 'Activated' THEN EXCLUDED.raw_lines ELSE public.payroll_entries.activated_lines END,
    gross_commission = EXCLUDED.gross_commission,
    pay_period_start = EXCLUDED.pay_period_start,
    pay_period_end = EXCLUDED.pay_period_end
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_sale_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_sale_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sale_status(uuid, text) TO service_role;