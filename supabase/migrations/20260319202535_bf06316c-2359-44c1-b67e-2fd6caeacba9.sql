
-- Update admin_verify_user to set a local config variable that bypasses the trigger
CREATE OR REPLACE FUNCTION public.admin_verify_user(_user_id uuid, _type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can verify users';
  END IF;

  -- Set a session-local flag so the trigger allows this update
  PERFORM set_config('app.admin_bypass', 'true', true);

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

-- Update the trigger to respect the bypass flag
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow bypass from trusted SECURITY DEFINER functions
  IF current_setting('app.admin_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF current_setting('role', true) = 'authenticated' THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'Direct balance modification is not allowed. Use server-side functions.';
    END IF;
    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
      RAISE EXCEPTION 'Direct email_verified modification is not allowed.';
    END IF;
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Direct phone_verified modification is not allowed.';
    END IF;
    IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'Direct email_verified_at modification is not allowed.';
    END IF;
    IF NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at THEN
      RAISE EXCEPTION 'Direct phone_verified_at modification is not allowed.';
    END IF;
    IF NEW.email_verified_by_admin IS DISTINCT FROM OLD.email_verified_by_admin THEN
      RAISE EXCEPTION 'Direct email_verified_by_admin modification is not allowed.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
