
-- Create game_unlock_requests table
CREATE TABLE public.game_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  UNIQUE(user_id, game_id)
);

-- Enable RLS
ALTER TABLE public.game_unlock_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own requests" ON public.game_unlock_requests
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own requests" ON public.game_unlock_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update requests" ON public.game_unlock_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view requests" ON public.game_unlock_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update requests" ON public.game_unlock_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'manager'));

-- Create service function for requesting game access
CREATE OR REPLACE FUNCTION public.request_game_access(_game_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _req_id UUID;
  _username TEXT;
  _email TEXT;
  _admin RECORD;
  _game_name TEXT;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit
  IF NOT check_rate_limit(_user_id, 'request_game_access', 5, 60) THEN
    RAISE EXCEPTION 'Too many requests. Please wait.';
  END IF;

  -- Check game exists and is active
  SELECT name INTO _game_name FROM public.games WHERE id = _game_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or inactive';
  END IF;

  -- Check if request already exists
  IF EXISTS (
    SELECT 1 FROM public.game_unlock_requests
    WHERE user_id = _user_id AND game_id = _game_id
  ) THEN
    RAISE EXCEPTION 'You already have a request for this game';
  END IF;

  -- Get user info
  SELECT p.username, u.email INTO _username, _email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = _user_id;

  INSERT INTO public.game_unlock_requests (user_id, game_id, username, email, status)
  VALUES (_user_id, _game_id, COALESCE(_username, 'unknown'), COALESCE(_email, 'unknown'), 'pending')
  RETURNING id INTO _req_id;

  -- Notify admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_admin.user_id, 'New Game Access Request',
      COALESCE(_username, 'A user') || ' requested access to ' || _game_name || '.',
      'info');
  END LOOP;

  RETURN _req_id;
END;
$$;

-- Create service function for approving/rejecting
CREATE OR REPLACE FUNCTION public.process_game_access_request(_request_id uuid, _action text, _note text DEFAULT NULL)
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

  SELECT * INTO _req FROM public.game_unlock_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  SELECT name INTO _game_name FROM public.games WHERE id = _req.game_id;

  IF _action = 'approved' THEN
    UPDATE public.game_unlock_requests
    SET status = 'approved', approved_at = now(), approved_by = _admin_id, admin_note = _note
    WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_req.user_id, 'Game Access Approved',
      'Your access to ' || COALESCE(_game_name, 'the game') || ' has been approved! You can now play.',
      'success');

    -- Fire email trigger
    PERFORM fire_email_trigger('game_access_approved', _req.user_id,
      jsonb_build_object('game_name', COALESCE(_game_name, 'the game')));

  ELSIF _action = 'rejected' THEN
    IF _note IS NULL OR _note = '' THEN
      RAISE EXCEPTION 'A note is required when rejecting a request';
    END IF;

    UPDATE public.game_unlock_requests
    SET status = 'rejected', admin_note = _note, approved_at = now(), approved_by = _admin_id
    WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_req.user_id, 'Game Access Rejected',
      'Your access request for ' || COALESCE(_game_name, 'the game') || ' was rejected. Reason: ' || _note,
      'warning');
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action || '_game_access', 'game_unlock_request', _request_id,
    jsonb_build_object('user_id', _req.user_id, 'game_id', _req.game_id, 'game', _game_name));
END;
$$;
