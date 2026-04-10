
CREATE OR REPLACE FUNCTION public.process_password_request(_request_id uuid, _new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req RECORD;
  _admin_id UUID;
  _game_name TEXT;
  _account_username TEXT;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') AND NOT has_role(_admin_id, 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_password_request', 20, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded.';
  END IF;

  IF length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT pr.*
  INTO _req
  FROM public.password_requests pr
  WHERE pr.id = _request_id AND pr.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Try to get game info from game_unlock_requests first
  SELECT gur.username, g.name INTO _account_username, _game_name
  FROM public.game_unlock_requests gur
  JOIN public.games g ON g.id = gur.game_id
  WHERE gur.id = _req.game_account_id;

  -- Fallback to game_accounts if not found in game_unlock_requests
  IF _account_username IS NULL THEN
    SELECT ga.username, g.name INTO _account_username, _game_name
    FROM public.game_accounts ga
    JOIN public.games g ON g.id = ga.game_id
    WHERE ga.id = _req.game_account_id;
  END IF;

  -- Update game_unlock_requests password if applicable
  UPDATE public.game_unlock_requests
  SET game_password = _new_password
  WHERE id = _req.game_account_id;

  -- Also update game_accounts if exists
  UPDATE public.game_accounts
  SET password_hash = _new_password, updated_at = now()
  WHERE id = _req.game_account_id;

  UPDATE public.password_requests
  SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, title, message, type, category)
  VALUES (_req.user_id, 'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || COALESCE(_account_username, 'unknown') || ') has been updated.', 'success', 'password_request');

  PERFORM fire_email_trigger(
    'password_request_approved',
    _req.user_id,
    jsonb_build_object('game_name', COALESCE(_game_name, 'your game'))
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'approved_password_request', 'password_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_account_id', _req.game_account_id, 'game', _game_name));
END;
$function$;
