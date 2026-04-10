
-- Remove GHL chat message logic from process_transaction
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

  SELECT username, display_name INTO _profile FROM public.profiles WHERE id = _txn.user_id;
  _display_name := COALESCE(_profile.display_name, _profile.username, 'there');

  IF _txn.game_id IS NOT NULL THEN
    SELECT g.name INTO _game_name FROM public.games g WHERE g.id = _txn.game_id;
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

  ELSE
    RAISE EXCEPTION 'Invalid action.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$function$;
