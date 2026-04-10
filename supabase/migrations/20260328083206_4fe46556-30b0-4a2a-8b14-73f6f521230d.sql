
CREATE OR REPLACE FUNCTION public.request_game_access(_game_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _req_id UUID;
  _username TEXT;
  _email TEXT;
  _admin RECORD;
  _game_name TEXT;
  _existing_status TEXT;
  _game_suffix TEXT;
  _game_username TEXT;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT check_rate_limit(_user_id, 'request_game_access', 5, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait.';
  END IF;

  SELECT name INTO _game_name FROM public.games WHERE id = _game_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  SELECT status INTO _existing_status
  FROM public.game_unlock_requests
  WHERE user_id = _user_id AND game_id = _game_id;

  IF _existing_status IS NOT NULL THEN
    IF _existing_status = 'rejected' THEN
      DELETE FROM public.game_unlock_requests
      WHERE user_id = _user_id AND game_id = _game_id AND status = 'rejected';
    ELSE
      RAISE EXCEPTION 'You already have a request for this game';
    END IF;
  END IF;

  SELECT p.username, u.email INTO _username, _email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = _user_id;

  -- Use specific suffix mapping per game name
  _game_suffix := CASE lower(trim(_game_name))
    WHEN 'fire kirin' THEN 'FK'
    WHEN 'game vault' THEN 'GV'
    WHEN 'juwa' THEN 'JW'
    WHEN 'juwa 2.0' THEN 'JW2'
    WHEN 'milky way' THEN 'MW'
    WHEN 'orion star' THEN 'OS'
    WHEN 'panda master' THEN 'PM'
    WHEN 'river sweeps' THEN 'RS'
    WHEN 'ultrapanda' THEN 'UP'
    WHEN 'vblink' THEN 'VB'
    WHEN 'vegas sweeps' THEN 'VS'
    ELSE upper(
      array_to_string(
        ARRAY(
          SELECT left(word, 1)
          FROM unnest(string_to_array(regexp_replace(_game_name, '[^a-zA-Z ]', '', 'g'), ' ')) AS word
          WHERE length(word) > 0
          LIMIT 2
        ),
        ''
      )
    )
  END;

  IF length(_game_suffix) = 0 THEN
    _game_suffix := 'XX';
  END IF;

  _game_username := COALESCE(_username, 'unknown') || _game_suffix;

  INSERT INTO public.game_unlock_requests (user_id, game_id, username, email, status)
  VALUES (_user_id, _game_id, _game_username, COALESCE(_email, 'unknown'), 'pending')
  RETURNING id INTO _req_id;

  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category)
    VALUES (_admin.user_id, 'New Game Access Request',
      _game_username || ' requested access to ' || _game_name || '.',
      'info', 'game_access');
  END LOOP;

  RETURN _req_id;
END;
$$;
