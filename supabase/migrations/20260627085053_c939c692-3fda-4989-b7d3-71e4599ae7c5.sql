CREATE POLICY "Public can view approved employee profiles"
ON public.employee_profiles
FOR SELECT
TO anon
USING (status = 'approved');

GRANT SELECT ON public.employee_profiles TO anon;