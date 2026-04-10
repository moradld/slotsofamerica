
CREATE OR REPLACE FUNCTION public.submit_transaction(_game_id uuid, _type text, _amount numeric, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _txn_id UUID;
  _balance NUMERIC;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate type
  IF _type NOT IN ('deposit', 'withdraw', 'redeem', 'transfer') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  -- Validate amount
  IF _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'Amount must be between $0.01 and $100,000';
  END IF;

  -- Rate limit: 5 submissions per minute
  IF NOT check_rate_limit(_user_id, 'submit_transaction', 5, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait before submitting another transaction.';
  END IF;

  -- Verify game exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND is_active = true) THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  -- Server-side balance check for withdraw, redeem, and transfer
  IF _type IN ('withdraw', 'redeem', 'transfer') THEN
    SELECT balance INTO _balance FROM public.profiles WHERE id = _user_id;
    IF _balance IS NULL OR _amount > _balance THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  INSERT INTO public.transactions (user_id, game_id, type, amount, status, notes)
  VALUES (_user_id, _game_id, _type, _amount, 'pending', _notes)
  RETURNING id INTO _txn_id;

  RETURN _txn_id;
END;
$$;
