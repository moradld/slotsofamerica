
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
  _game_username TEXT;
  _conv_log_id UUID;
  _chat_body TEXT;
  _display_name TEXT;
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
    RAISE EXCEPTION 'Transaction not found or already processed';
  END IF;

  -- Get user profile for personalized message
  SELECT username, display_name INTO _profile FROM public.profiles WHERE id = _txn.user_id;
  _display_name := COALESCE(_profile.display_name, _profile.username, 'there');

  -- Get game name and game username
  IF _txn.game_id IS NOT NULL THEN
    SELECT g.name INTO _game_name FROM public.games g WHERE g.id = _txn.game_id;
    SELECT ga.username INTO _game_username FROM public.game_accounts ga WHERE ga.game_id = _txn.game_id AND ga.assigned_to = _txn.user_id LIMIT 1;
  END IF;

  IF _action = 'approved' THEN
    UPDATE public.transactions
    SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_txn.user_id, 'Transaction Approved',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been approved.', 'success');

    PERFORM fire_email_trigger(
      'transaction_approved_' || _txn.type,
      _txn.user_id,
      jsonb_build_object('amount', _txn.amount, 'type', _txn.type, 'status', 'Approved')
    );

    -- Build chat message for approved
    _chat_body := 'Hello ' || _display_name || '! ✅ Your ' || initcap(_txn.type) || ' of $' || _txn.amount::TEXT || ' has been approved.';
    IF _game_name IS NOT NULL THEN
      _chat_body := _chat_body || ' Game: ' || _game_name || '.';
    END IF;
    IF _game_username IS NOT NULL THEN
      _chat_body := _chat_body || ' Account: ' || _game_username || '.';
    END IF;
    _chat_body := _chat_body || ' Thank you!';

  ELSIF _action = 'rejected' THEN
    UPDATE public.transactions
    SET status = 'rejected', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_txn.user_id, 'Transaction Rejected',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been rejected.', 'warning');

    PERFORM fire_email_trigger(
      'transaction_rejected_' || _txn.type,
      _txn.user_id,
      jsonb_build_object('amount', _txn.amount, 'type', _txn.type, 'status', 'Rejected')
    );

    -- Build chat message for rejected
    _chat_body := 'Hello ' || _display_name || ', ❌ Your ' || initcap(_txn.type) || ' of $' || _txn.amount::TEXT || ' has been rejected. Please contact support if you have any questions.';
    IF _game_name IS NOT NULL THEN
      _chat_body := _chat_body || ' Game: ' || _game_name || '.';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid action.';
  END IF;

  -- Insert chat message to user's conversation
  SELECT id INTO _conv_log_id FROM public.ghl_conversation_logs
    WHERE user_id = _txn.user_id
    ORDER BY created_at DESC LIMIT 1;

  IF _conv_log_id IS NOT NULL THEN
    INSERT INTO public.chat_messages (conversation_log_id, user_id, body, direction)
    VALUES (_conv_log_id, _txn.user_id, _chat_body, 'outbound');
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$function$;
