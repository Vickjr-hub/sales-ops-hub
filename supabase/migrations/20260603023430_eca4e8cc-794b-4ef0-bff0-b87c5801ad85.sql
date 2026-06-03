
CREATE TABLE public.payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_name TEXT NOT NULL,
  raw_lines INTEGER NOT NULL DEFAULT 0,
  activated_lines INTEGER NOT NULL DEFAULT 0,
  internet_sales INTEGER NOT NULL DEFAULT 0,
  directv_sales INTEGER NOT NULL DEFAULT 0,
  gross_commission NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all payroll" ON public.payroll_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TYPE public.applicant_status AS ENUM ('Applied','Interview Scheduled','Interview Completed','Hired','Rejected');

CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  status public.applicant_status NOT NULL DEFAULT 'Applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all applicants" ON public.applicants FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_line_rate NUMERIC NOT NULL DEFAULT 200,
  internet_rate NUMERIC NOT NULL DEFAULT 0,
  directv_rate NUMERIC NOT NULL DEFAULT 50
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.settings (phone_line_rate, internet_rate, directv_rate) VALUES (200, 0, 50);
