CREATE OR REPLACE FUNCTION public.bulk_form16_lookup_code(_code text)
RETURNS TABLE(match_status text, user_id uuid, employee_profile_id uuid, employee_name text, pan_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cnt int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT count(*) INTO cnt FROM public.employee_profiles WHERE employee_code = _code;
  IF cnt = 0 THEN
    RETURN QUERY SELECT 'unmatched'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text;
  ELSIF cnt > 1 THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text;
  ELSE
    RETURN QUERY
      SELECT 'matched'::text, ep.user_id, ep.id, ep.name, ep.pan_number
      FROM public.employee_profiles ep WHERE ep.employee_code = _code LIMIT 1;
  END IF;
END; $function$;