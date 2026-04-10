
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'prodtest@example.com');
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'prodtest@example.com');
DELETE FROM auth.users WHERE email = 'prodtest@example.com';
SELECT setval('public.gamepaneluser_seq', COALESCE((SELECT MAX(CASE WHEN username ~ '^gamepaneluser[0-9]+$' THEN CAST(substring(username from 'gamepaneluser([0-9]+)$') AS INT) ELSE 0 END) FROM public.profiles), 0));
