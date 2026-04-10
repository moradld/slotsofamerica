-- Enable pg_net for HTTP calls from database functions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a helper function to fire email triggers
CREATE OR REPLACE FUNCTION public.fire_email_trigger(
  _event text,
  _user_id uuid,
  _data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Get project URL and service role key
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  -- If vault secrets aren't available, use environment-based fallback
  IF _supabase_url IS NULL THEN
    _supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF _service_key IS NULL THEN
    _service_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  -- Only proceed if we have the URL
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/trigger-email',
      body := jsonb_build_object('event', _event, 'user_id', _user_id, 'data', _data)::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      )::text
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the transaction if email trigger fails
  RAISE WARNING 'Email trigger failed for event %: %', _event, SQLERRM;
END;
$$;

-- Update process_transaction to fire email triggers
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

    -- Fire email trigger
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

    -- Fire email trigger
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
$$;

-- Update process_password_request to fire email triggers
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

  -- Fire email trigger
  PERFORM fire_email_trigger(
    'password_request_approved',
    _req.user_id,
    jsonb_build_object('game_name', COALESCE(_game_name, 'your game'))
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'approved_password_request', 'password_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_account_id', _req.game_account_id, 'game', _game_name));
END;
$$;
