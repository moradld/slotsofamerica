
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _raw_username TEXT;
  _clean_username TEXT;
BEGIN
  _raw_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  _clean_username := regexp_replace(_raw_username, '[^a-zA-Z0-9_]', '_', 'g');
  _clean_username := trim(both '_' from _clean_username);
  IF _clean_username = '' THEN
    _clean_username := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    _clean_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', _clean_username),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$function$;
