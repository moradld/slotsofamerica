
CREATE OR REPLACE FUNCTION public.admin_verify_user(
  _user_id uuid,
  _type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can verify users';
  END IF;

  IF _type = 'email' THEN
    UPDATE public.profiles
    SET email_verified = true,
        email_verified_at = now(),
        email_verified_by_admin = true
    WHERE id = _user_id;
  ELSIF _type = 'phone' THEN
    UPDATE public.profiles
    SET phone_verified = true,
        phone_verified_at = now()
    WHERE id = _user_id;
  ELSIF _type = 'both' THEN
    UPDATE public.profiles
    SET email_verified = true,
        email_verified_at = now(),
        email_verified_by_admin = true,
        phone_verified = true,
        phone_verified_at = now()
    WHERE id = _user_id;
  ELSE
    RAISE EXCEPTION 'Invalid type. Use email, phone, or both.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'admin_verify_' || _type, 'user', _user_id,
    jsonb_build_object('type', _type));
END;
$$;
