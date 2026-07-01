
-- 1. Drop legacy admin-claim + resubmit trigger/function
DROP TRIGGER IF EXISTS trg_employee_profile_resubmit ON public.employee_profiles;
DROP FUNCTION IF EXISTS public.employee_profile_resubmit();
DROP FUNCTION IF EXISTS public.claim_admin_if_none();

-- 2. Extend employee_profiles
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS pan_front_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_front_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_back_url text,
  ADD COLUMN IF NOT EXISTS pan_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pan_verified_by uuid,
  ADD COLUMN IF NOT EXISTS aadhaar_verified_by uuid,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS ifsc text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_profiles_pan
  ON public.employee_profiles(pan_number) WHERE pan_number IS NOT NULL;

-- 3. Tighten RLS: employees cannot UPDATE or DELETE directly
DROP POLICY IF EXISTS "Users can update their own employee profile" ON public.employee_profiles;
DROP POLICY IF EXISTS "Users can delete their own employee profile" ON public.employee_profiles;
DROP POLICY IF EXISTS "Public can view approved employee profiles" ON public.employee_profiles;

-- 4. form16_documents: enforce unique (user_id, financial_year) for upsert
CREATE UNIQUE INDEX IF NOT EXISTS ux_form16_user_fy
  ON public.form16_documents(user_id, financial_year);

-- 5. profile_change_requests
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_change_requests TO authenticated;
GRANT ALL ON public.profile_change_requests TO service_role;
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own change requests" ON public.profile_change_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user inserts own change requests" ON public.profile_change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "admin reads all change requests" ON public.profile_change_requests
  FOR SELECT USING (public.is_admin());
CREATE POLICY "admin updates change requests" ON public.profile_change_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_pcr_updated BEFORE UPDATE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS ix_pcr_user_status ON public.profile_change_requests(user_id, status);
CREATE INDEX IF NOT EXISTS ix_pcr_status_submitted ON public.profile_change_requests(status, submitted_at DESC);

-- 6. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user updates own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin reads all notifications" ON public.notifications
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS ix_notif_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notif_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- 7. Helper: emit notification (SECURITY DEFINER, bypasses RLS)
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _body text, _type text, _related_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, body, type, related_id)
  VALUES (_user_id, _title, _body, _type, _related_id);
END;
$$;

-- 8. Approve / Reject change request RPCs
CREATE OR REPLACE FUNCTION public.approve_change_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profile_change_requests%ROWTYPE;
  k text;
  v jsonb;
  sql_set text := '';
  first boolean := true;
  ep_exists boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO r FROM public.profile_change_requests WHERE id = _req_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found or not pending'; END IF;

  -- Ensure employee_profiles row exists
  SELECT EXISTS(SELECT 1 FROM public.employee_profiles WHERE user_id = r.user_id) INTO ep_exists;
  IF NOT ep_exists THEN
    INSERT INTO public.employee_profiles(user_id, status) VALUES (r.user_id, 'approved');
  END IF;

  -- Build dynamic UPDATE from changes jsonb: { field: { old, new } }
  FOR k, v IN SELECT key, value FROM jsonb_each(r.changes) LOOP
    IF NOT first THEN sql_set := sql_set || ', '; END IF;
    sql_set := sql_set || format('%I = %L', k, v->>'new');
    first := false;
  END LOOP;

  IF sql_set <> '' THEN
    EXECUTE format('UPDATE public.employee_profiles SET %s, status=''approved'', approved_at=now(), rejection_reason=NULL, updated_at=now() WHERE user_id = %L', sql_set, r.user_id);
  ELSE
    UPDATE public.employee_profiles SET status='approved', approved_at=now(), rejection_reason=NULL, updated_at=now() WHERE user_id = r.user_id;
  END IF;

  UPDATE public.profile_change_requests
    SET status='approved', reviewed_at=now(), reviewed_by=auth.uid()
    WHERE id = _req_id;

  PERFORM public.notify_user(r.user_id, 'Profile approved', 'Your profile changes have been approved.', 'profile_approved', _req_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_change_request(_req_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.profile_change_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'reason too short'; END IF;
  SELECT * INTO r FROM public.profile_change_requests WHERE id = _req_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found or not pending'; END IF;

  UPDATE public.profile_change_requests
    SET status='rejected', reviewed_at=now(), reviewed_by=auth.uid(), rejection_reason=_reason
    WHERE id = _req_id;

  UPDATE public.employee_profiles SET rejection_reason=_reason, updated_at=now() WHERE user_id = r.user_id;

  PERFORM public.notify_user(r.user_id, 'Profile rejected', _reason, 'profile_rejected', _req_id);
END;
$$;

-- 9. Verify PAN / Aadhaar RPCs
CREATE OR REPLACE FUNCTION public.verify_pan(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.employee_profiles
    SET pan_verified_at=now(), pan_verified_by=auth.uid(), updated_at=now()
    WHERE user_id=_user_id;
  PERFORM public.notify_user(_user_id, 'PAN verified', 'Your PAN has been verified by the admin.', 'pan_verified', NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.verify_aadhaar(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.employee_profiles
    SET aadhaar_verified_at=now(), aadhaar_verified_by=auth.uid(), updated_at=now()
    WHERE user_id=_user_id;
  PERFORM public.notify_user(_user_id, 'Aadhaar verified', 'Your Aadhaar has been verified by the admin.', 'aadhaar_verified', NULL);
END; $$;

-- 10. Bulk Form 16 lookup RPC — returns matched user_id, employee_profile_id or a status
CREATE OR REPLACE FUNCTION public.bulk_form16_lookup(_pan text)
RETURNS TABLE(match_status text, user_id uuid, employee_profile_id uuid, employee_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cnt int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT count(*) INTO cnt FROM public.employee_profiles WHERE pan_number = _pan;
  IF cnt = 0 THEN
    RETURN QUERY SELECT 'unmatched'::text, NULL::uuid, NULL::uuid, NULL::text;
  ELSIF cnt > 1 THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::uuid, NULL::uuid, NULL::text;
  ELSE
    RETURN QUERY
      SELECT 'matched'::text, ep.user_id, ep.id, ep.name
      FROM public.employee_profiles ep WHERE ep.pan_number = _pan LIMIT 1;
  END IF;
END; $$;

-- 11. Bulk Form 16 finalize RPC — re-verifies PAN mapping and upserts form16_documents
CREATE OR REPLACE FUNCTION public.bulk_form16_upload_finalize(
  _pan text, _financial_year text, _file_path text, _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ep record; new_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT id, user_id INTO ep FROM public.employee_profiles WHERE pan_number = _pan;
  IF NOT FOUND THEN RAISE EXCEPTION 'no employee for PAN'; END IF;
  IF (SELECT count(*) FROM public.employee_profiles WHERE pan_number = _pan) > 1 THEN
    RAISE EXCEPTION 'duplicate PAN mapping';
  END IF;

  INSERT INTO public.form16_documents(user_id, employee_profile_id, financial_year, source, file_path, uploaded_by, notes)
  VALUES (ep.user_id, ep.id, _financial_year, 'upload', _file_path, auth.uid(), _notes)
  ON CONFLICT (user_id, financial_year) DO UPDATE
    SET file_path = EXCLUDED.file_path, source='upload', uploaded_by=auth.uid(), notes=COALESCE(EXCLUDED.notes, public.form16_documents.notes), updated_at=now()
  RETURNING id INTO new_id;

  PERFORM public.notify_user(ep.user_id, 'Form 16 uploaded',
    'Your Form 16 for '||_financial_year||' has been uploaded.', 'form16_uploaded', new_id);
  RETURN new_id;
END; $$;

-- 12. Employee self view — masked PAN and Aadhaar so raw numbers never leave DB to employees
CREATE OR REPLACE VIEW public.employee_self_view
WITH (security_invoker = true) AS
SELECT
  ep.id, ep.user_id, ep.employee_code, ep.name, ep.father_name, ep.dob, ep.address,
  ep.phone, ep.email, ep.qualification, ep.designation, ep.department, ep.salary,
  ep.photo_url, ep.status, ep.approved_at, ep.submitted_at, ep.rejection_reason,
  ep.bank_name,
  CASE WHEN ep.account_number IS NULL OR length(ep.account_number) < 4 THEN NULL
       ELSE repeat('X', greatest(length(ep.account_number)-4,0)) || right(ep.account_number,4) END AS account_number_masked,
  ep.ifsc,
  ep.emergency_contact_name, ep.emergency_contact_phone,
  CASE WHEN ep.pan_number IS NULL OR length(ep.pan_number) < 4 THEN NULL
       ELSE '******' || right(ep.pan_number,4) END AS pan_masked,
  CASE WHEN ep.aadhaar_number IS NULL OR length(ep.aadhaar_number) < 4 THEN NULL
       ELSE 'XXXX XXXX ' || right(ep.aadhaar_number,4) END AS aadhaar_masked,
  ep.pan_front_url, ep.aadhaar_front_url, ep.aadhaar_back_url,
  ep.pan_verified_at, ep.aadhaar_verified_at,
  ep.created_at, ep.updated_at
FROM public.employee_profiles ep
WHERE ep.user_id = auth.uid();

GRANT SELECT ON public.employee_self_view TO authenticated;

-- 13. Admin seed trigger + backfill
CREATE OR REPLACE FUNCTION public.grant_bccl_admin_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.email = 'admin@bccl.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_bccl_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_bccl_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_bccl_admin_on_signup();

INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@bccl.com'
ON CONFLICT DO NOTHING;
