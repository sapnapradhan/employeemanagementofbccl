ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.employee_profiles
  DROP CONSTRAINT IF EXISTS employee_profiles_status_check;
ALTER TABLE public.employee_profiles
  ADD CONSTRAINT employee_profiles_status_check
  CHECK (status IN ('pending','approved','rejected'));

DROP POLICY IF EXISTS "Admins can update all employee profiles" ON public.employee_profiles;
CREATE POLICY "Admins can update all employee profiles"
  ON public.employee_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete all employee profiles" ON public.employee_profiles;
CREATE POLICY "Admins can delete all employee profiles"
  ON public.employee_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));