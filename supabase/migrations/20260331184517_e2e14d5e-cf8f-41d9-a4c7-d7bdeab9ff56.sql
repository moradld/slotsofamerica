DROP POLICY "Anon can read widget settings" ON public.app_settings;
CREATE POLICY "Anon can read widget settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key IN ('contact_display_mode', 'contact_button_label', 'contact_header_title', 'contact_widget_position', 'contact_button_color'));