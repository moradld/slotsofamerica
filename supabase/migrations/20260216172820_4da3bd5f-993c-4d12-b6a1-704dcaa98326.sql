
-- Add phone_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- Create rewards_config table
CREATE TABLE public.rewards_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards_config ENABLE ROW LEVEL SECURITY;

-- Admin can read/write
CREATE POLICY "Admins can manage rewards config"
  ON public.rewards_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read (to show reward amounts in UI)
CREATE POLICY "Authenticated users can read rewards config"
  ON public.rewards_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default phone verification reward
INSERT INTO public.rewards_config (key, value, description, is_active)
VALUES ('phone_verification_reward', 2.00, 'Gift amount for phone number verification', true);

-- Phone verification OTP tracking table
CREATE TABLE public.phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications"
  ON public.phone_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verifications"
  ON public.phone_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for rewards_config updated_at
CREATE TRIGGER update_rewards_config_updated_at
  BEFORE UPDATE ON public.rewards_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
