
-- Create verification_codes table
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'phone')),
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own codes
CREATE POLICY "Users can view own verification codes" ON public.verification_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can view all verification codes
CREATE POLICY "Admins can view all verification codes" ON public.verification_codes
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Admins can update verification codes
CREATE POLICY "Admins can update verification codes" ON public.verification_codes
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Create verification_settings table
CREATE TABLE public.verification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_expiry_minutes INTEGER NOT NULL DEFAULT 10,
  resend_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  max_per_hour INTEGER NOT NULL DEFAULT 5,
  email_verification_enabled BOOLEAN NOT NULL DEFAULT true,
  phone_verification_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read verification settings
CREATE POLICY "Authenticated users can read verification settings" ON public.verification_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage verification settings
CREATE POLICY "Admins can manage verification settings" ON public.verification_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.verification_settings (otp_expiry_minutes, resend_cooldown_seconds, max_attempts, max_per_hour, email_verification_enabled, phone_verification_enabled)
VALUES (10, 60, 5, 5, true, true);
