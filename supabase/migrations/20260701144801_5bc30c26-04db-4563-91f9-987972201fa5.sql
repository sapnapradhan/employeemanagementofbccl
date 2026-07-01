
REVOKE ALL ON FUNCTION public.approve_change_request(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reject_change_request(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.verify_pan(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.verify_aadhaar(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.bulk_form16_lookup(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.bulk_form16_upload_finalize(text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_bccl_admin_on_signup() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_change_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_change_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_aadhaar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_form16_lookup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_form16_upload_finalize(text, text, text, text) TO authenticated;
