
-- Server-side function for admin to process password requests
CREATE OR REPLACE FUNCTION public.process_password_request(_request_id UUID, _new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _req RECORD;
  _admin_id UUID;
  _game_name TEXT;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pr.*, ga.game_id, ga.username as account_username
  INTO _req
  FROM public.password_requests pr
  JOIN public.game_accounts ga ON ga.id = pr.game_account_id
  WHERE pr.id = _request_id AND pr.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Update game account password
  UPDATE public.game_accounts
  SET password_hash = _new_password, updated_at = now()
  WHERE id = _req.game_account_id;

  -- Mark request as completed
  UPDATE public.password_requests
  SET status = 'completed', reviewed_by = _admin_id, reviewed_at = now()
  WHERE id = _request_id;

  -- Get game name for notification
  SELECT name INTO _game_name FROM public.games WHERE id = _req.game_id;

  -- Notify user
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    _req.user_id,
    'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || _req.account_username || ') has been updated.',
    'success'
  );
END;
$$;
