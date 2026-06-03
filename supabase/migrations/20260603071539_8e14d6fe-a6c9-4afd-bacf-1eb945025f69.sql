
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS pay_period_start date,
  ADD COLUMN IF NOT EXISTS pay_period_end date;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS interview_date date,
  ADD COLUMN IF NOT EXISTS interview_time time;
