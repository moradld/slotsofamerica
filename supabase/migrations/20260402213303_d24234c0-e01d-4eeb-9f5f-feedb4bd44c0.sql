CREATE POLICY "Authenticated can read widget settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN (
  'contact_display_mode',
  'contact_button_label',
  'contact_header_title',
  'contact_widget_position',
  'contact_button_color',
  'contact_text_color'
));