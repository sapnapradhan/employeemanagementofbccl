
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE OR REPLACE FUNCTION public.employee_profile_resubmit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF (NEW.name, NEW.father_name, NEW.dob, NEW.address, NEW.phone, NEW.aadhaar,
      NEW.email, NEW.qualification, NEW.designation, NEW.department, NEW.salary,
      NEW.photo_url, NEW.employee_code)
     IS DISTINCT FROM
     (OLD.name, OLD.father_name, OLD.dob, OLD.address, OLD.phone, OLD.aadhaar,
      OLD.email, OLD.qualification, OLD.designation, OLD.department, OLD.salary,
      OLD.photo_url, OLD.employee_code)
  THEN
    NEW.status := 'pending';
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_profile_resubmit ON public.employee_profiles;
CREATE TRIGGER trg_employee_profile_resubmit
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.employee_profile_resubmit();

CREATE TABLE IF NOT EXISTS public.form16_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_profile_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  financial_year text NOT NULL,
  source text NOT NULL CHECK (source IN ('uploaded','generated')),
  file_path text,
  gross_salary numeric DEFAULT 0,
  tds numeric DEFAULT 0,
  deductions jsonb DEFAULT '{}'::jsonb,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_profile_id, financial_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form16_documents TO authenticated;
GRANT ALL ON public.form16_documents TO service_role;

ALTER TABLE public.form16_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own approved form16"
ON public.form16_documents FOR SELECT TO authenticated
USING (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.id = form16_documents.employee_profile_id AND ep.status = 'approved'
  )
);

CREATE POLICY "Admins view all form16"
ON public.form16_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert form16"
ON public.form16_documents FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update form16"
ON public.form16_documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete form16"
ON public.form16_documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_form16_updated_at
  BEFORE UPDATE ON public.form16_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Admins manage form16 files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'form16-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'form16-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees read own form16 files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'form16-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
CREATE POLICY "Admins manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
