
-- Allow managers to view transactions
CREATE POLICY "Managers view all transactions"
  ON public.transactions FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to update transactions
CREATE POLICY "Managers update transactions"
  ON public.transactions FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view all password requests
CREATE POLICY "Managers view password requests"
  ON public.password_requests FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to update password requests
CREATE POLICY "Managers update password requests"
  ON public.password_requests FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view all profiles
CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view game accounts
CREATE POLICY "Managers view game accounts"
  ON public.game_accounts FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to update game accounts
CREATE POLICY "Managers update game accounts"
  ON public.game_accounts FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view their own role
CREATE POLICY "Managers can view roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to create notifications
CREATE POLICY "Managers create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view audit logs
CREATE POLICY "Managers can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to insert audit logs
CREATE POLICY "Managers can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Update process_transaction to allow managers
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
  ELSIF _action = 'rejected' THEN
    UPDATE public.transactions
    SET status = 'rejected', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_txn.user_id, 'Transaction Rejected',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been rejected.', 'warning');
  ELSE
    RAISE EXCEPTION 'Invalid action.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$$;

-- Update process_password_request to allow managers
CREATE OR REPLACE FUNCTION public.process_password_request(_request_id uuid, _new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_req.user_id, 'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || _req.account_username || ') has been updated.', 'success');

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'approved_password_request', 'password_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_account_id', _req.game_account_id, 'game', _game_name));
END;
$$;

-- Function for admins to delete users
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM public.transactions WHERE user_id = _user_id;
  DELETE FROM public.password_requests WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.game_accounts WHERE assigned_to = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
