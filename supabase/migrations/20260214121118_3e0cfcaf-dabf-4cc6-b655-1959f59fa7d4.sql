
-- RPC: unlock (assign) an available game account to the calling user for a given game
CREATE OR REPLACE FUNCTION public.unlock_game_account(_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _account RECORD;
  _remaining INT;
  _admin RECORD;
  _game_name TEXT;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit
  IF NOT check_rate_limit(_user_id, 'unlock_game_account', 5, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait.';
  END IF;

  -- Check game exists and is active
  SELECT name INTO _game_name FROM public.games WHERE id = _game_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  -- Check if user already has an account for this game
  IF EXISTS (
    SELECT 1 FROM public.game_accounts
    WHERE game_id = _game_id AND assigned_to = _user_id
  ) THEN
    RAISE EXCEPTION 'You already have an account for this game';
  END IF;

  -- Grab first available account
  SELECT * INTO _account
  FROM public.game_accounts
  WHERE game_id = _game_id
    AND status = 'available'
    AND assigned_to IS NULL
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No available accounts for this game. Please contact support.';
  END IF;

  -- Assign
  UPDATE public.game_accounts
  SET assigned_to = _user_id, status = 'assigned', updated_at = now()
  WHERE id = _account.id;

  -- Low stock check
  SELECT COUNT(*) INTO _remaining
  FROM public.game_accounts
  WHERE game_id = _game_id AND status = 'available' AND assigned_to IS NULL;

  IF _remaining <= 5 THEN
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (_admin.user_id, 'Low Stock: ' || _game_name,
        'Only ' || _remaining || ' available account(s) remaining for ' || _game_name || '.', 'warning');
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'account_id', _account.id,
    'username', _account.username,
    'password', _account.password_hash
  );
END;
$$;
