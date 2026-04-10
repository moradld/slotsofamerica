
-- Add admin_bypass to process_transaction
CREATE OR REPLACE FUNCTION public.process_transaction(_transaction_id uuid, _action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
$$;

-- Add admin_bypass to edit_transaction_amount
CREATE OR REPLACE FUNCTION public.edit_transaction_amount(_transaction_id uuid, _new_amount numeric, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _txn RECORD;
  _admin_id UUID;
  _diff NUMERIC;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can edit transaction amounts';
  END IF;

  IF _new_amount <= 0 OR _new_amount > 100000 THEN
    RAISE EXCEPTION 'Amount must be between $0.01 and $100,000';
  END IF;

  SELECT * INTO _txn FROM public.transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  PERFORM set_config('app.admin_bypass', 'true', true);

  IF _txn.status = 'completed' THEN
    _diff := _new_amount - _txn.amount;
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _diff WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _diff WHERE id = _txn.user_id;
    END IF;
  ELSIF _txn.status != 'pending' THEN
    RAISE EXCEPTION 'Can only edit pending or completed transactions';
  END IF;

  UPDATE public.transactions SET amount = _new_amount WHERE id = _transaction_id;

  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, 'edited', _txn.status, _txn.status, _txn.amount, _new_amount, _admin_id, _reason);

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'edit_transaction_amount', 'transaction', _transaction_id,
    jsonb_build_object('old_amount', _txn.amount, 'new_amount', _new_amount, 'reason', _reason, 'user_id', _txn.user_id));
END;
$$;

-- Add admin_bypass to undo_transaction
CREATE OR REPLACE FUNCTION public.undo_transaction(_transaction_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  PERFORM set_config('app.admin_bypass', 'true', true);

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
$$;

-- Add admin_bypass to submit_transaction (for withdraw/transfer balance check the trigger fires on SELECT not UPDATE, but let's also cover the rate-limit flagging update)
CREATE OR REPLACE FUNCTION public.submit_transaction(_game_id uuid, _type text, _amount numeric, _notes text DEFAULT NULL::text, _payment_gateway_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _txn_id UUID;
  _balance NUMERIC;
  _min_amount NUMERIC;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _type NOT IN ('deposit', 'withdraw', 'redeem', 'transfer') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  IF _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'Amount must be between $0.01 and $100,000';
  END IF;

  IF NOT check_rate_limit(_user_id, 'submit_transaction', 5, 60) THEN
    PERFORM set_config('app.admin_bypass', 'true', true);
    UPDATE public.profiles 
    SET is_flagged = true, 
        flagged_at = now(), 
        flagged_reason = 'Auto-flagged: exceeded 5 transactions in 1 minute'
    WHERE id = _user_id;

    PERFORM log_security_event(
      'transaction_rate_limit_exceeded',
      _user_id,
      jsonb_build_object('type', _type, 'amount', _amount, 'message', 'User exceeded 5 transactions in 1 minute'),
      'high'
    );

    INSERT INTO public.admin_notifications (type, title, message, user_id)
    VALUES (
      'security',
      'Suspicious Activity Flagged',
      'User attempted more than 5 transactions within 1 minute. Account auto-flagged for review.',
      _user_id
    );

    RAISE EXCEPTION 'Too many requests. Please wait before submitting another transaction.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND is_active = true) THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  IF _type IN ('withdraw', 'transfer') THEN
    SELECT balance INTO _balance FROM public.profiles WHERE id = _user_id;
    IF _balance IS NULL OR _amount > _balance THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  IF _type = 'deposit' AND _payment_gateway_id IS NOT NULL THEN
    SELECT minimum_amount INTO _min_amount FROM public.payment_gateways WHERE id = _payment_gateway_id AND is_active = true;
    IF _min_amount IS NULL THEN
      RAISE EXCEPTION 'Payment gateway not found or inactive';
    END IF;
    IF _amount < _min_amount THEN
      RAISE EXCEPTION 'Minimum deposit for this method is $%', _min_amount;
    END IF;
  END IF;

  INSERT INTO public.transactions (user_id, game_id, type, amount, status, notes)
  VALUES (_user_id, _game_id, _type, _amount, 'pending', _notes)
  RETURNING id INTO _txn_id;

  RETURN _txn_id;
END;
$$;
