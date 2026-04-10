
-- Backfill: create profiles for any users missing one
INSERT INTO public.profiles (id, username, display_name, email)
SELECT u.id, 'gamepaneluser' || lpad(nextval('public.gamepaneluser_seq')::text, 3, '0'),
       'gamepaneluser' || currval('public.gamepaneluser_seq')::text,
       u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill: add user role for any users missing one
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.id IS NULL;
