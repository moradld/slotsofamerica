
-- Managers can view ALL payment gateways (not just active)
CREATE POLICY "Managers can view all payment gateways"
ON public.payment_gateways FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert payment gateways
CREATE POLICY "Managers can insert payment gateways"
ON public.payment_gateways FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Managers can update payment gateways
CREATE POLICY "Managers can update payment gateways"
ON public.payment_gateways FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete payment gateways
CREATE POLICY "Managers can delete payment gateways"
ON public.payment_gateways FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can view ALL withdraw methods (not just active)
CREATE POLICY "Managers can view all withdraw methods"
ON public.withdraw_methods FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert withdraw methods
CREATE POLICY "Managers can insert withdraw methods"
ON public.withdraw_methods FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Managers can update withdraw methods
CREATE POLICY "Managers can update withdraw methods"
ON public.withdraw_methods FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete withdraw methods
CREATE POLICY "Managers can delete withdraw methods"
ON public.withdraw_methods FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert games
CREATE POLICY "Managers can insert games"
ON public.games FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete games
CREATE POLICY "Managers can delete games"
ON public.games FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can manage gateway accounts
CREATE POLICY "Managers can view gateway accounts"
ON public.payment_gateway_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert gateway accounts"
ON public.payment_gateway_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update gateway accounts"
ON public.payment_gateway_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete gateway accounts"
ON public.payment_gateway_accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can manage game accounts (insert + delete missing)
CREATE POLICY "Managers can insert game accounts"
ON public.game_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete game accounts"
ON public.game_accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));
