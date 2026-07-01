
CREATE OR REPLACE FUNCTION public.approve_change_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profile_change_requests%ROWTYPE;
  flat jsonb;
  base public.employee_profiles%ROWTYPE;
  merged public.employee_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO r FROM public.profile_change_requests WHERE id = _req_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found or not pending'; END IF;

  -- Ensure a profile row exists
  SELECT * INTO base FROM public.employee_profiles WHERE user_id = r.user_id;
  IF NOT FOUND THEN
    INSERT INTO public.employee_profiles(user_id, status) VALUES (r.user_id, 'approved') RETURNING * INTO base;
  END IF;

  -- Flatten { field: {old,new} } to { field: new }
  SELECT COALESCE(jsonb_object_agg(key, value->'new'), '{}'::jsonb)
    INTO flat FROM jsonb_each(r.changes);

  merged := jsonb_populate_record(base, flat);

  UPDATE public.employee_profiles SET
    employee_code            = merged.employee_code,
    name                     = merged.name,
    father_name              = merged.father_name,
    dob                      = merged.dob,
    address                  = merged.address,
    phone                    = merged.phone,
    email                    = merged.email,
    qualification            = merged.qualification,
    designation              = merged.designation,
    department               = merged.department,
    salary                   = merged.salary,
    photo_url                = merged.photo_url,
    pan_number               = merged.pan_number,
    aadhaar_number           = merged.aadhaar_number,
    pan_front_url            = merged.pan_front_url,
    aadhaar_front_url        = merged.aadhaar_front_url,
    aadhaar_back_url         = merged.aadhaar_back_url,
    bank_name                = merged.bank_name,
    account_number           = merged.account_number,
    ifsc                     = merged.ifsc,
    emergency_contact_name   = merged.emergency_contact_name,
    emergency_contact_phone  = merged.emergency_contact_phone,
    status                   = 'approved',
    approved_at              = now(),
    rejection_reason         = NULL,
    updated_at               = now()
  WHERE user_id = r.user_id;

  UPDATE public.profile_change_requests
    SET status='approved', reviewed_at=now(), reviewed_by=auth.uid()
    WHERE id = _req_id;

  PERFORM public.notify_user(r.user_id, 'Profile approved',
    'Your profile changes have been approved.', 'profile_approved', _req_id);
END;
$$;
