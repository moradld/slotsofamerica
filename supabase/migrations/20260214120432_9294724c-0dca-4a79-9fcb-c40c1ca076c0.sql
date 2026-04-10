CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _game RECORD;
  _account RECORD;
  _remaining INT;
  _admin RECORD;
  _raw_username TEXT;
  _clean_username TEXT;
BEGIN
  -- Generate clean username: prefer metadata username, fallback to email prefix
  _raw_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- Remove any non-alphanumeric/underscore characters
  _clean_username := regexp_replace(_raw_username, '[^a-zA-Z0-9_]', '_', 'g');
  -- Remove leading/trailing underscores
  _clean_username := trim(both '_' from _clean_username);
  -- Fallback if empty
  IF _clean_username = '' THEN
    _clean_username := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    _clean_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', _clean_username)
  );

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Loop through active games and assign first available account
  FOR _game IN SELECT id, name FROM public.games WHERE is_active = true
  LOOP
    SELECT * INTO _account
    FROM public.game_accounts
    WHERE game_id = _game.id
      AND status = 'available'
      AND assigned_to IS NULL
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
      UPDATE public.game_accounts
      SET assigned_to = NEW.id,
          status = 'assigned',
          updated_at = now()
      WHERE id = _account.id;

      SELECT COUNT(*) INTO _remaining
      FROM public.game_accounts
      WHERE game_id = _game.id
        AND status = 'available'
        AND assigned_to IS NULL;

      IF _remaining <= 5 THEN
        FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
        LOOP
          INSERT INTO public.notifications (user_id, title, message, type)
          VALUES (
            _admin.user_id,
            'Low Stock: ' || _game.name,
            'Only ' || _remaining || ' available account(s) remaining for ' || _game.name || '.',
            'warning'
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;