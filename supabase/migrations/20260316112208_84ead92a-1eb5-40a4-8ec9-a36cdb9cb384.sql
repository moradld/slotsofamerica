
-- Create a sequence for auto-incrementing usernames
CREATE SEQUENCE IF NOT EXISTS public.gamepaneluser_seq;

-- Set the sequence to the current max value
SELECT setval('public.gamepaneluser_seq', COALESCE(
  (SELECT MAX(
    CASE 
      WHEN username ~ '^gamepaneluser[0-9]+$' 
      THEN CAST(substring(username from 'gamepaneluser([0-9]+)$') AS INT)
      ELSE 0
    END
  ) FROM public.profiles), 0
));

-- Replace the handle_new_user function with a race-condition-safe version
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _next_num INT;
  _clean_username TEXT;
BEGIN
  _next_num := nextval('public.gamepaneluser_seq');
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
