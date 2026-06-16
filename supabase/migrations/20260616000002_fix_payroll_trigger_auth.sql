-- Fix sync_sale_to_payroll trigger to remove broken auth.uid() check
-- Triggers execute without user context, so auth.uid() is always NULL
-- Instead, trust RLS policies for access control

CREATE OR REPLACE FUNCTION public.sync_sale_to_payroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric(12,2);
  v_commission numeric(12,2);
  v_rep_name text;
  v_owner_id uuid;
BEGIN
  -- Only sync if status actually changed
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only process Approved or Activated statuses
  IF NEW.status NOT IN ('Approved', 'Activated') THEN
    RETURN NEW;
  END IF;

  -- Attempt to get current user ID (will be NULL in trigger context)
  BEGIN
    v_owner_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_owner_id := NULL;
  END;

  -- Set approval metadata
  NEW.approved_by := v_owner_id;
  NEW.approved_at := now();
  
  -- Set activation status if moving to Activated
  IF NEW.status = 'Activated' THEN
    NEW.activation_status := 'Activated';
  END IF;

  -- Fetch commission rate from settings
  SELECT COALESCE(phone_line_rate, 200)
  INTO v_rate
  FROM public.settings
  ORDER BY id LIMIT 1;
  v_rate := COALESCE(v_rate, 200);
  v_commission := COALESCE(NEW.lines, 0) * v_rate;

  -- Fetch rep name from profiles
  SELECT COALESCE(NULLIF(full_name, ''), 'Representative')
  INTO v_rep_name
  FROM public.profiles
  WHERE id = NEW.rep_id;
  v_rep_name := COALESCE(v_rep_name, 'Representative');

  -- Insert or update payroll entry
  INSERT INTO public.payroll_entries (
    sale_id, rep_id, owner_id, commission_amount, product_type, sale_value,
    activation_date, status, rep_name, raw_lines, activated_lines,
    internet_sales, directv_sales, gross_commission,
    pay_period_start, pay_period_end
  ) VALUES (
    NEW.id, NEW.rep_id, v_owner_id, v_commission, 'phone_line', NEW.sale_value,
    CASE WHEN NEW.status = 'Activated' THEN CURRENT_DATE ELSE NULL END,
    'pending_payout', v_rep_name, NEW.lines,
    CASE WHEN NEW.status = 'Activated' THEN NEW.lines ELSE 0 END,
    0, 0, v_commission,
    date_trunc('week', NEW.sale_date::timestamp)::date,
    date_trunc('week', NEW.sale_date::timestamp)::date + 6
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
    activated_lines = CASE WHEN NEW.status = 'Activated' THEN EXCLUDED.raw_lines ELSE public.payroll_entries.activated_lines END,
    gross_commission = EXCLUDED.gross_commission,
    pay_period_start = EXCLUDED.pay_period_start,
    pay_period_end = EXCLUDED.pay_period_end;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_to_payroll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_sale_to_payroll() TO service_role;
