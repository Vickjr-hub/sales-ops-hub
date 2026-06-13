REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
DROP POLICY IF EXISTS "Owners insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners delete roles" ON public.user_roles;