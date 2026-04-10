
CREATE POLICY "Managers can read daily withdraw limit"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND key = 'daily_withdraw_limit'
);

CREATE POLICY "Managers can update daily withdraw limit"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND key = 'daily_withdraw_limit'
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND key = 'daily_withdraw_limit'
);
