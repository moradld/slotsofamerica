
INSERT INTO public.profiles (id, username, display_name, email)
VALUES ('0d3a7453-3a2f-44ec-ac37-ae14db5faead', 'hridooysaha', 'hridooysaha', 'hridooysaha@gmail.com')
ON CONFLICT (id) DO NOTHING;
