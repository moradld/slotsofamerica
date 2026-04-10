
-- Payment gateways table for admin-managed payment methods
CREATE TABLE public.payment_gateways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  qr_code_url TEXT,
  minimum_amount NUMERIC NOT NULL DEFAULT 10,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- Everyone can view active gateways (needed for deposit page)
CREATE POLICY "Anyone can view active payment gateways"
ON public.payment_gateways
FOR SELECT
USING (true);

-- Only admins can manage gateways
CREATE POLICY "Admins can insert payment gateways"
ON public.payment_gateways
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payment gateways"
ON public.payment_gateways
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete payment gateways"
ON public.payment_gateways
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_payment_gateways_updated_at
BEFORE UPDATE ON public.payment_gateways
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
