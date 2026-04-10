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
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_password_request', 20, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before processing more requests.';
  END IF;

  IF length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT pr.*, ga.game_id, ga.username as account_username
  INTO _req
  FROM public.password_requests pr
  JOIN public.game_accounts ga ON ga.id = pr.game_account_id
  WHERE pr.id = _request_id AND pr.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  UPDATE public.game_accounts
  SET password_hash = _new_password, updated_at = now()
  WHERE id = _req.game_account_id;

  UPDATE public.password_requests
  SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
  WHERE id = _request_id;

  SELECT name INTO _game_name FROM public.games WHERE id = _req.game_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_req.user_id, 'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || _req.account_username || ') has been updated.', 'success');

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'approved_password_request', 'password_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_account_id', _req.game_account_id, 'game', _game_name));
END;
$function$;