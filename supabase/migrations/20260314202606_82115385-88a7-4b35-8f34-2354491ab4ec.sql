
-- Create admin_notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  user_id uuid,
  transaction_id uuid,
  status text NOT NULL DEFAULT 'unread',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can read
CREATE POLICY "Admins can view admin notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Only admins and managers can update (mark as read)
CREATE POLICY "Admins can update admin notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Allow inserts from triggers (security definer functions)
CREATE POLICY "System can insert admin notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Trigger function for new transactions
CREATE OR REPLACE FUNCTION public.notify_admin_new_transaction()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _username text;
BEGIN
  SELECT COALESCE(display_name, username, 'Unknown') INTO _username
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.admin_notifications (type, title, message, user_id, transaction_id)
  VALUES (
    'transaction',
    'New ' || initcap(NEW.type) || ' Request',
    _username || ' submitted a ' || NEW.type || ' of $' || NEW.amount::text,
    NEW.user_id,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_new_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_transaction();

-- Trigger function for game access requests
CREATE OR REPLACE FUNCTION public.notify_admin_game_access()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _game_name text;
BEGIN
  SELECT name INTO _game_name FROM public.games WHERE id = NEW.game_id;

  INSERT INTO public.admin_notifications (type, title, message, user_id)
  VALUES (
    'game_access',
    'New Game Access Request',
    NEW.username || ' requested access to ' || COALESCE(_game_name, 'a game'),
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_game_access
  AFTER INSERT ON public.game_unlock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_game_access();

-- Trigger function for password change requests
CREATE OR REPLACE FUNCTION public.notify_admin_password_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _username text;
BEGIN
  SELECT COALESCE(display_name, username, 'Unknown') INTO _username
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.admin_notifications (type, title, message, user_id)
  VALUES (
    'password_request',
    'New Password Change Request',
    _username || ' requested a password change',
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_password_request
  AFTER INSERT ON public.password_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_password_request();
