DROP POLICY IF EXISTS "owners write automated payroll" ON public.payroll_entries;
REVOKE INSERT, UPDATE, DELETE ON public.payroll_entries FROM authenticated;
GRANT SELECT ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;