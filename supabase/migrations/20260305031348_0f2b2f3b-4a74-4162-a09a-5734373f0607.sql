
-- Update process_transaction to include category
CREATE OR REPLACE FUNCTION public.process_transaction(_transaction_id uuid, _action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _txn RECORD;
  _admin_id UUID;
  _profile RECORD;
  _game_name TEXT;
  _new_status TEXT;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') AND NOT has_role(_admin_id, 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_transaction', 30, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded.';
  END IF;

  SELECT * INTO _txn FROM public.transactions WHERE id = _transaction_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not pending';
  END IF;

  SELECT username, display_name INTO _profile FROM public.profiles WHERE id = _txn.user_id;

  IF _txn.game_id IS NOT NULL THEN
    SELECT g.name INTO _game_name FROM public.games g WHERE g.id = _txn.game_id;
  END IF;

  IF _action = 'approved' THEN
    _new_status := 'completed';
  ELSIF _action = 'rejected' THEN
    _new_status := 'rejected';
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;

  UPDATE public.transactions
  SET status = _new_status, reviewed_by = _admin_id, reviewed_at = now()
  WHERE id = _transaction_id;

  IF _new_status = 'completed' THEN
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;
  END IF;

  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, _new_status, 'pending', _new_status, _txn.amount, _txn.amount, _admin_id, NULL);

  INSERT INTO public.notifications (user_id, title, message, type, category)
  VALUES (_txn.user_id,
    CASE WHEN _new_status = 'completed' THEN 'Transaction Approved' ELSE 'Transaction Rejected' END,
    'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been ' || _new_status || '.',
    CASE WHEN _new_status = 'completed' THEN 'success' ELSE 'warning' END,
    _txn.type);

  PERFORM fire_email_trigger(
    'transaction_' || _new_status || '_' || _txn.type,
    _txn.user_id,
    jsonb_build_object('amount', _txn.amount, 'type', _txn.type, 'status', _new_status)
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _new_status || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$function$;

-- Update process_game_access_request (4-param version) to include category
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

    INSERT INTO public.notifications (user_id, title, message, type, category)
    VALUES (_req.user_id, 'Game Access Approved',
      'Your access to ' || COALESCE(_game_name, 'the game') || ' has been approved! You can now play.',
      'success', 'game_access');

    PERFORM fire_email_trigger('game_access_approved', _req.user_id,
      jsonb_build_object('game_name', COALESCE(_game_name, 'the game')));

  ELSIF _action = 'rejected' THEN
    IF _note IS NULL OR _note = '' THEN
      RAISE EXCEPTION 'A note is required when rejecting a request';
    END IF;

    UPDATE public.game_unlock_requests
    SET status = 'rejected', admin_note = _note, approved_at = now(), approved_by = _admin_id
    WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, title, message, type, category)
    VALUES (_req.user_id, 'Game Access Rejected',
      'Your access request for ' || COALESCE(_game_name, 'the game') || ' was rejected. Reason: ' || _note,
      'warning', 'game_access');
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_game_access', 'game_unlock_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_id', _req.game_id, 'game', _game_name));
END;
$function$;

-- Update process_password_request to include category
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

  IF NOT has_role(_admin_id, 'admin') AND NOT has_role(_admin_id, 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_password_request', 20, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded.';
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

  INSERT INTO public.notifications (user_id, title, message, type, category)
  VALUES (_req.user_id, 'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || _req.account_username || ') has been updated.', 'success', 'password_request');

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

-- Update request_game_access to include category
CREATE OR REPLACE FUNCTION public.request_game_access(_game_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _req_id UUID;
  _username TEXT;
  _email TEXT;
  _admin RECORD;
  _game_name TEXT;
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

  IF EXISTS (
    SELECT 1 FROM public.game_unlock_requests
    WHERE user_id = _user_id AND game_id = _game_id
  ) THEN
    RAISE EXCEPTION 'You already have a request for this game';
  END IF;

  SELECT p.username, u.email INTO _username, _email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = _user_id;

  INSERT INTO public.game_unlock_requests (user_id, game_id, username, email, status)
  VALUES (_user_id, _game_id, COALESCE(_username, 'unknown'), COALESCE(_email, 'unknown'), 'pending')
  RETURNING id INTO _req_id;

  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category)
    VALUES (_admin.user_id, 'New Game Access Request',
      COALESCE(_username, 'A user') || ' requested access to ' || _game_name || '.',
      'info', 'game_access');
  END LOOP;

  RETURN _req_id;
END;
$function$;

-- Update check_low_stock_notifications to include category
CREATE OR REPLACE FUNCTION public.check_low_stock_notifications()
 RETURNS TABLE(game_name text, available bigint, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _game RECORD;
  _admin RECORD;
  _existing INT;
BEGIN
  FOR _game IN
    SELECT g.id, g.name,
      COUNT(*) FILTER (WHERE ga.status = 'available' AND ga.assigned_to IS NULL) AS avail,
      COUNT(*) AS tot
    FROM public.games g
    LEFT JOIN public.game_accounts ga ON ga.game_id = g.id
    WHERE g.is_active = true
    GROUP BY g.id, g.name
    HAVING COUNT(*) FILTER (WHERE ga.status = 'available' AND ga.assigned_to IS NULL) <= 5
  LOOP
    SELECT COUNT(*) INTO _existing
    FROM public.notifications
    WHERE title = 'Low Stock: ' || _game.name
      AND created_at > now() - interval '24 hours';

    IF _existing = 0 THEN
      FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type, category)
        VALUES (
          _admin.user_id,
          'Low Stock: ' || _game.name,
          'Only ' || _game.avail || ' available account(s) remaining for ' || _game.name || '.',
          'warning', 'system'
        );
      END LOOP;
    END IF;

    game_name := _game.name;
    available := _game.avail;
    total := _game.tot;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Update undo_transaction to include category
CREATE OR REPLACE FUNCTION public.undo_transaction(_transaction_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _txn RECORD;
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can undo transactions';
  END IF;

  SELECT * INTO _txn FROM public.transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF _txn.status NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Can only undo completed or rejected transactions';
  END IF;

  IF _txn.status = 'completed' THEN
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    END IF;
  END IF;

  UPDATE public.transactions
  SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
  WHERE id = _transaction_id;

  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, 'undone', _txn.status, 'pending', _txn.amount, _txn.amount, _admin_id, _reason);

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'undo_transaction', 'transaction', _transaction_id,
    jsonb_build_object('old_status', _txn.status, 'reason', _reason, 'user_id', _txn.user_id));
END;
$function$;
