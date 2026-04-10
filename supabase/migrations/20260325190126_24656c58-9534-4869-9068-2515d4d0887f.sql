
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
  _notif_message TEXT;
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

  -- Set bypass flag for balance update
  PERFORM set_config('app.admin_bypass', 'true', true);

  IF _new_status = 'completed' THEN
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;
  END IF;

  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, _new_status, 'pending', _new_status, _txn.amount, _txn.amount, _admin_id, NULL);

  -- Build notification message, include rejection reason if present
  _notif_message := 'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been ' || _new_status || '.';
  
  IF _new_status = 'rejected' AND _txn.notes IS NOT NULL AND _txn.notes LIKE '%Rejection Reason:%' THEN
    _notif_message := _notif_message || ' Reason: ' || substring(_txn.notes FROM 'Rejection Reason: (.*)$');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, category)
  VALUES (_txn.user_id,
    CASE WHEN _new_status = 'completed' THEN 'Transaction Approved' ELSE 'Transaction Rejected' END,
    _notif_message,
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
