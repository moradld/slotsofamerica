
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
    -- Flag the account by logging a high-severity security event
    PERFORM log_security_event(
      'transaction_rate_limit_exceeded',
      _user_id,
      jsonb_build_object('type', _type, 'amount', _amount, 'message', 'User exceeded 5 transactions in 1 minute'),
      'high'
    );

    -- Notify admins about suspicious activity
    INSERT INTO public.admin_notifications (type, title, message, user_id)
    VALUES (
      'security',
      'Suspicious Activity Flagged',
      'User attempted more than 5 transactions within 1 minute. Account flagged for review.',
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
