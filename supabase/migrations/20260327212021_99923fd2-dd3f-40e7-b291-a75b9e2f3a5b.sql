
-- Update admin_delete_user to protect the first admin
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _first_admin_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Find the first admin (earliest created profile with admin role)
  SELECT ur.user_id INTO _first_admin_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF _user_id = _first_admin_id THEN
    RAISE EXCEPTION 'The primary admin account cannot be deleted';
  END IF;

  DELETE FROM public.transactions WHERE user_id = _user_id;
  DELETE FROM public.password_requests WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.game_accounts WHERE assigned_to = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;

-- Create a function to get the first admin id
CREATE OR REPLACE FUNCTION public.get_first_admin_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1
$$;
