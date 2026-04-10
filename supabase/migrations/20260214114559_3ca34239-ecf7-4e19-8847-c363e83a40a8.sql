
-- Admin audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_logs_admin ON public.audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Rate limiting table
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access — only via security definer function
CREATE POLICY "No direct access to rate_limits"
  ON public.rate_limits FOR SELECT USING (false);

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(user_id, action, created_at DESC);

-- Rate limiting check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id UUID,
  _action TEXT,
  _max_requests INT DEFAULT 10,
  _window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _count INT;
BEGIN
  -- Clean old entries
  DELETE FROM public.rate_limits
  WHERE user_id = _user_id AND action = _action
    AND created_at < now() - make_interval(secs => _window_seconds);

  -- Count recent requests
  SELECT COUNT(*) INTO _count
  FROM public.rate_limits
  WHERE user_id = _user_id AND action = _action
    AND created_at >= now() - make_interval(secs => _window_seconds);

  IF _count >= _max_requests THEN
    RETURN FALSE;
  END IF;

  -- Record this request
  INSERT INTO public.rate_limits (user_id, action) VALUES (_user_id, _action);
  RETURN TRUE;
END;
$$;

-- Update process_transaction to include audit logging and rate limiting
CREATE OR REPLACE FUNCTION public.process_transaction(_transaction_id UUID, _action TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _txn RECORD;
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Rate limit: 30 actions per minute for admins
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

    IF _txn.type IN ('deposit') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'redeem', 'transfer') THEN
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

  -- Audit log
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_transaction', 'transaction', _transaction_id,
    jsonb_build_object('type', _txn.type, 'amount', _txn.amount, 'user_id', _txn.user_id));
END;
$$;

-- Update process_password_request to include audit logging and rate limiting
CREATE OR REPLACE FUNCTION public.process_password_request(_request_id UUID, _new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _req RECORD;
  _admin_id UUID;
  _game_name TEXT;
BEGIN
  _admin_id := auth.uid();

  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT check_rate_limit(_admin_id, 'process_password_request', 20, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before processing more requests.';
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
  SET status = 'completed', reviewed_by = _admin_id, reviewed_at = now()
  WHERE id = _request_id;

  SELECT name INTO _game_name FROM public.games WHERE id = _req.game_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_req.user_id, 'Password Updated',
    'Your password for ' || COALESCE(_game_name, 'your game') || ' account (' || _req.account_username || ') has been updated.', 'success');

  -- Audit log (never log the password itself)
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'approved_password_request', 'password_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_account_id', _req.game_account_id, 'game', _game_name));
END;
$$;

-- Rate-limited transaction submission function
CREATE OR REPLACE FUNCTION public.submit_transaction(
  _game_id UUID,
  _type TEXT,
  _amount NUMERIC,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id UUID;
  _txn_id UUID;
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

  INSERT INTO public.transactions (user_id, game_id, type, amount, status, notes)
  VALUES (_user_id, _game_id, _type, _amount, 'pending', _notes)
  RETURNING id INTO _txn_id;

  RETURN _txn_id;
END;
$$;

-- Rate-limited password request submission
CREATE OR REPLACE FUNCTION public.submit_password_request(_game_account_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id UUID;
  _req_id UUID;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit: 3 requests per minute
  IF NOT check_rate_limit(_user_id, 'submit_password_request', 3, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait before submitting another request.';
  END IF;

  -- Verify account belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.game_accounts
    WHERE id = _game_account_id AND assigned_to = _user_id
  ) THEN
    RAISE EXCEPTION 'Game account not found or not assigned to you';
  END IF;

  -- Check for existing pending request
  IF EXISTS (
    SELECT 1 FROM public.password_requests
    WHERE game_account_id = _game_account_id AND user_id = _user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this account';
  END IF;

  INSERT INTO public.password_requests (user_id, game_account_id, status)
  VALUES (_user_id, _game_account_id, 'pending')
  RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;
