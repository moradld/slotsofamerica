
-- 1. Create transaction_logs table
CREATE TABLE public.transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  action text NOT NULL, -- created, approved, rejected, edited, undone
  old_status text,
  new_status text,
  old_amount numeric,
  new_amount numeric,
  action_by uuid NOT NULL,
  action_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view transaction logs"
  ON public.transaction_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert transaction logs"
  ON public.transaction_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view transaction logs"
  ON public.transaction_logs FOR SELECT
  USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can insert transaction logs"
  ON public.transaction_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'manager'));

-- 2. Replace process_transaction to use 'completed' status and log actions
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

  -- Wallet adjustment for completed
  IF _new_status = 'completed' THEN
    IF _txn.type IN ('deposit', 'redeem') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;
  END IF;

  -- Log
  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, _new_status, 'pending', _new_status, _txn.amount, _txn.amount, _admin_id, NULL);

  -- Notification
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_txn.user_id,
    CASE WHEN _new_status = 'completed' THEN 'Transaction Approved' ELSE 'Transaction Rejected' END,
    'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been ' || _new_status || '.',
    CASE WHEN _new_status = 'completed' THEN 'success' ELSE 'warning' END);

  -- Email trigger
  PERFORM fire_email_trigger(
    'transaction_' || _new_status || '_' || _txn.type,
    _txn.user_id,
    jsonb_build_object('amount', _txn.amount, 'type', _txn.type, 'status', _new_status)
  );

  -- Audit
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _new_status || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$$;

-- 3. Create undo_transaction function
CREATE OR REPLACE FUNCTION public.undo_transaction(_transaction_id uuid, _reason text DEFAULT NULL)
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

  -- Reverse wallet if was completed
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

  -- Log
  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, 'undone', _txn.status, 'pending', _txn.amount, _txn.amount, _admin_id, _reason);

  -- Audit
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'undo_transaction', 'transaction', _transaction_id,
    jsonb_build_object('old_status', _txn.status, 'reason', _reason, 'user_id', _txn.user_id));
END;
$$;

-- 4. Create edit_transaction_amount function
CREATE OR REPLACE FUNCTION public.edit_transaction_amount(_transaction_id uuid, _new_amount numeric, _reason text DEFAULT NULL)
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

  IF _txn.status = 'completed' THEN
    -- Recalculate wallet difference
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

  -- Log
  INSERT INTO public.transaction_logs (transaction_id, action, old_status, new_status, old_amount, new_amount, action_by, note)
  VALUES (_transaction_id, 'edited', _txn.status, _txn.status, _txn.amount, _new_amount, _admin_id, _reason);

  -- Audit
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'edit_transaction_amount', 'transaction', _transaction_id,
    jsonb_build_object('old_amount', _txn.amount, 'new_amount', _new_amount, 'reason', _reason, 'user_id', _txn.user_id));
END;
$$;
