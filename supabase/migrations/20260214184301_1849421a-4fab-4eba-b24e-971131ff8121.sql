
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
    RAISE EXCEPTION 'Too many requests. Please wait before submitting another transaction.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND is_active = true) THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  -- Server-side balance check for withdraw and transfer only (redeem ADDS money)
  IF _type IN ('withdraw', 'transfer') THEN
    SELECT balance INTO _balance FROM public.profiles WHERE id = _user_id;
    IF _balance IS NULL OR _amount > _balance THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  -- Server-side minimum amount check for deposits via payment gateway
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

-- Update process_transaction: redeem now ADDS to balance like deposit
CREATE OR REPLACE FUNCTION public.process_transaction(_transaction_id uuid, _action text)
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
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_transaction', 30, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before processing more transactions.';
  END IF;

  SELECT * INTO _txn FROM public.transactions WHERE id = _transaction_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or already processed';
  END IF;

  IF _action = 'approved' THEN
    UPDATE public.transactions
    SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    -- Deposit and Redeem ADD to balance; Withdraw and Transfer DEDUCT
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_txn.user_id, 'Transaction Approved',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been approved.', 'success');

  ELSIF _action = 'rejected' THEN
    UPDATE public.transactions
    SET status = 'rejected', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_txn.user_id, 'Transaction Rejected',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been rejected.', 'warning');
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$$;
