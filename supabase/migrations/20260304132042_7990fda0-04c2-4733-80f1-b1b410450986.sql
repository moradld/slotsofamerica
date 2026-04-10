CREATE OR REPLACE FUNCTION public.process_game_access_request(_request_id uuid, _action text, _note text DEFAULT NULL::text, _game_password text DEFAULT NULL::text)
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

  IF NOT has_role(_admin_id, 'admin') AND NOT has_role(_admin_id, 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _req FROM public.game_unlock_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  SELECT name INTO _game_name FROM public.games WHERE id = _req.game_id;

  IF _action = 'approved' THEN
    UPDATE public.game_unlock_requests
    SET status = 'approved', approved_at = now(), approved_by = _admin_id, admin_note = _note, game_password = _game_password
    WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_req.user_id, 'Game Access Approved',
      'Your access to ' || COALESCE(_game_name, 'the game') || ' has been approved! You can now play.',
      'success');

    PERFORM fire_email_trigger('game_access_approved', _req.user_id,
      jsonb_build_object('game_name', COALESCE(_game_name, 'the game')));

  ELSIF _action = 'rejected' THEN
    IF _note IS NULL OR _note = '' THEN
      RAISE EXCEPTION 'A note is required when rejecting a request';
    END IF;

    UPDATE public.game_unlock_requests
    SET status = 'rejected', admin_note = _note, approved_at = now(), approved_by = _admin_id
    WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_req.user_id, 'Game Access Rejected',
      'Your access request for ' || COALESCE(_game_name, 'the game') || ' was rejected. Reason: ' || _note,
      'warning');
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_game_access', 'game_unlock_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_id', _req.game_id, 'game', _game_name));
END;
$function$;