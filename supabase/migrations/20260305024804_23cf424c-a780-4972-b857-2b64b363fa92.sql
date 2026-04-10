CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean_username TEXT;
  _next_num INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN username ~ '^gamepaneluser[0-9]+$' 
      THEN CAST(substring(username from 'gamepaneluser([0-9]+)$') AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO _next_num
  FROM public.profiles;

  _clean_username := 'gamepaneluser' || lpad(_next_num::text, 3, '0');

  INSERT INTO public.profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    _clean_username,
    _clean_username,
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$function$;