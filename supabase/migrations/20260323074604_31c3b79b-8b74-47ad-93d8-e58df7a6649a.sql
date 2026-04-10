
-- Add deep_link column to payment_gateways
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS deep_link text;

-- Create payment_gateway_accounts table for multiple accounts per gateway
CREATE TABLE public.payment_gateway_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id uuid NOT NULL REFERENCES public.payment_gateways(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_number text NOT NULL,
  deep_link text,
  qr_code_url text,
  is_active boolean NOT NULL DEFAULT true,
  priority_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_gateway_accounts
CREATE POLICY "Admins can manage gateway accounts" ON public.payment_gateway_accounts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active gateway accounts" ON public.payment_gateway_accounts
  FOR SELECT USING (is_active = true);

-- Add deposit_proof_url to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deposit_proof_url text;

-- Create deposit-proofs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-proofs', 'deposit-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for deposit-proofs
CREATE POLICY "Users can upload deposit proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'deposit-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own deposit proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all deposit proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'deposit-proofs' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on payment_gateway_accounts
CREATE TRIGGER update_payment_gateway_accounts_updated_at
  BEFORE UPDATE ON public.payment_gateway_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
