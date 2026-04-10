
-- Function to check low stock and insert notifications for admins
CREATE OR REPLACE FUNCTION public.check_low_stock_notifications()
RETURNS TABLE(game_name TEXT, available BIGINT, total BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _game RECORD;
  _admin RECORD;
  _existing INT;
BEGIN
  FOR _game IN
    SELECT g.id, g.name,
      COUNT(*) FILTER (WHERE ga.status = 'available' AND ga.assigned_to IS NULL) AS avail,
      COUNT(*) AS tot
    FROM public.games g
    LEFT JOIN public.game_accounts ga ON ga.game_id = g.id
    WHERE g.is_active = true
    GROUP BY g.id, g.name
    HAVING COUNT(*) FILTER (WHERE ga.status = 'available' AND ga.assigned_to IS NULL) <= 5
  LOOP
    -- Check if a recent (last 24h) low stock notification already exists for this game
    SELECT COUNT(*) INTO _existing
    FROM public.notifications
    WHERE title = 'Low Stock: ' || _game.name
      AND created_at > now() - interval '24 hours';

    IF _existing = 0 THEN
      FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
          _admin.user_id,
          'Low Stock: ' || _game.name,
          'Only ' || _game.avail || ' available account(s) remaining for ' || _game.name || '.',
          'warning'
        );
      END LOOP;
    END IF;

    game_name := _game.name;
    available := _game.avail;
    total := _game.tot;
    RETURN NEXT;
  END LOOP;
END;
$$;
