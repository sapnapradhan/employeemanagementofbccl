
-- Roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Security definer role checker (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Employee profiles (one per user)
CREATE TABLE public.employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  father_name TEXT,
  dob DATE,
  address TEXT,
  phone TEXT,
  aadhaar TEXT,
  email TEXT,
  qualification TEXT,
  designation TEXT,
  department TEXT,
  salary NUMERIC(12,2),
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_profiles TO authenticated;
GRANT ALL ON public.employee_profiles TO service_role;

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own employee profile"
  ON public.employee_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employee profiles"
  ON public.employee_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own employee profile"
  ON public.employee_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own employee profile"
  ON public.employee_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own employee profile"
  ON public.employee_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_employee_profiles_updated_at
BEFORE UPDATE ON public.employee_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Storage policies for employee-photos bucket (bucket itself created via tool)
CREATE POLICY "Public can view employee photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Users can upload their own employee photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own employee photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own employee photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
