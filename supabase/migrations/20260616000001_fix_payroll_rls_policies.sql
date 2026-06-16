-- Fix RLS policies on payroll_entries to allow trigger writes
-- The trigger runs as service_role and needs INSERT/UPDATE permissions via RLS

DROP POLICY IF EXISTS "owners view payroll" ON public.payroll_entries;
DROP POLICY IF EXISTS "owners write automated payroll" ON public.payroll_entries;

-- Grant base permissions to authenticated role
GRANT INSERT, UPDATE ON public.payroll_entries TO authenticated;

-- Policy for INSERT: allow trigger to insert payroll entries
CREATE POLICY "payroll_insert_via_trigger" ON public.payroll_entries
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy for UPDATE: allow trigger to update payroll entries
CREATE POLICY "payroll_update_via_trigger" ON public.payroll_entries
  FOR UPDATE TO authenticated
  WITH CHECK (true);

-- Policy for SELECT: owners only
CREATE POLICY "payroll_select_owners_only" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
