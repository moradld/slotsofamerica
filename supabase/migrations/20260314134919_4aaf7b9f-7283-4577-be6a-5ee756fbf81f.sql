
-- Drop the FK that references game_accounts (users don't have game_accounts assigned)
ALTER TABLE public.password_requests DROP CONSTRAINT IF EXISTS password_requests_game_account_id_fkey;

-- Update the submit function to validate against game_unlock_requests instead
CREATE OR REPLACE FUNCTION public.submit_password_request(_game_account_id uuid, _new_password text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _req_id UUID;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT check_rate_limit(_user_id, 'submit_password_request', 3, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait before submitting another request.';
  END IF;

  -- Check if user has an approved game unlock request with this ID
  IF NOT EXISTS (
    SELECT 1 FROM public.game_unlock_requests
    WHERE id = _game_account_id AND user_id = _user_id AND status = 'approved'
  ) THEN
    -- Fallback: also check game_accounts for backward compatibility
    IF NOT EXISTS (
      SELECT 1 FROM public.game_accounts
      WHERE id = _game_account_id AND assigned_to = _user_id
    ) THEN
      RAISE EXCEPTION 'Game account not found or not assigned to you';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.password_requests
    WHERE game_account_id = _game_account_id AND user_id = _user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this account';
  END IF;

  IF _new_password IS NOT NULL AND length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.password_requests (user_id, game_account_id, status, requested_password)
  VALUES (_user_id, _game_account_id, 'pending', _new_password)
  RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$function$;
