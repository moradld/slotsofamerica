
DROP POLICY "System can insert admin notifications" ON public.admin_notifications;

CREATE POLICY "Admins and managers can insert admin notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
