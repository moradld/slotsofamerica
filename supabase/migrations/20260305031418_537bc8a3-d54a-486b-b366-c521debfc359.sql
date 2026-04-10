
-- Function for admin to broadcast notification to all users or a specific user
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  _title text, 
  _message text, 
  _type text DEFAULT 'info',
  _category text DEFAULT 'system',
  _target_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id UUID;
  _count INTEGER := 0;
  _user RECORD;
BEGIN
  _admin_id := auth.uid();
  
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can send notifications';
  END IF;
  
  IF _title IS NULL OR _title = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  
  IF _message IS NULL OR _message = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  
  IF _target_user_id IS NOT NULL THEN
    -- Send to specific user
    INSERT INTO public.notifications (user_id, title, message, type, category)
    VALUES (_target_user_id, _title, _message, _type, _category);
    _count := 1;
  ELSE
    -- Send to all users
    FOR _user IN SELECT id FROM public.profiles
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, category)
      VALUES (_user.id, _title, _message, _type, _category);
      _count := _count + 1;
    END LOOP;
  END IF;
  
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'send_notification', 'notification', NULL,
    jsonb_build_object('title', _title, 'target_user_id', _target_user_id, 'recipients', _count));
  
  RETURN _count;
END;
$function$;
