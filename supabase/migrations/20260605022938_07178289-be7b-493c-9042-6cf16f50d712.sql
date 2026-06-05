
-- Roles
CREATE TYPE public.app_role AS ENUM ('owner', 'rep');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profile policies
CREATE POLICY "users read own profile, owners read all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles policies (read only for users; mutations via service role / triggers)
CREATE POLICY "user sees own roles, owners see all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

-- Auto-create profile + assign role on signup (first user = owner, others = rep)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') INTO owner_exists;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN owner_exists THEN 'rep'::public.app_role ELSE 'owner'::public.app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users as owner
INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email, '') FROM auth.users
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  spm_number TEXT NOT NULL,
  lines INTEGER NOT NULL DEFAULT 1,
  sale_type TEXT NOT NULL CHECK (sale_type IN ('New Customer', 'Upgrade')),
  package_type TEXT NOT NULL CHECK (package_type IN ('Standard', 'Extra', 'Premium')),
  notes TEXT,
  photo_url TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reps see own, owners see all" ON public.sales
  FOR SELECT TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "reps insert own sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid());
CREATE POLICY "reps edit own pending; owners edit any" ON public.sales
  FOR UPDATE TO authenticated
  USING ((rep_id = auth.uid() AND status = 'Pending') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK ((rep_id = auth.uid() AND status = 'Pending') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "owners delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Restrict existing tables to owners only
DROP POLICY IF EXISTS "auth all payroll" ON public.payroll_entries;
CREATE POLICY "owners manage payroll" ON public.payroll_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "auth all applicants" ON public.applicants;
CREATE POLICY "owners manage applicants" ON public.applicants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "auth all settings" ON public.settings;
CREATE POLICY "owners manage settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
