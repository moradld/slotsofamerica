
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _game RECORD;
  _account RECORD;
  _remaining INT;
  _admin RECORD;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Loop through active games and assign first available account
  FOR _game IN SELECT id, name FROM public.games WHERE is_active = true
  LOOP
    SELECT * INTO _account
    FROM public.game_accounts
    WHERE game_id = _game.id
      AND status = 'available'
      AND assigned_to IS NULL
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
      UPDATE public.game_accounts
      SET assigned_to = NEW.id,
          status = 'assigned',
          updated_at = now()
      WHERE id = _account.id;

      -- Check remaining available accounts for this game
      SELECT COUNT(*) INTO _remaining
      FROM public.game_accounts
      WHERE game_id = _game.id
        AND status = 'available'
        AND assigned_to IS NULL;

      IF _remaining <= 5 THEN
        -- Notify all admins
        FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
        LOOP
          INSERT INTO public.notifications (user_id, title, message, type)
          VALUES (
            _admin.user_id,
            'Low Stock: ' || _game.name,
            'Only ' || _remaining || ' available account(s) remaining for ' || _game.name || '.',
            'warning'
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
