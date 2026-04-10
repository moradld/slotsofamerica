
-- Create withdraw_methods table
CREATE TABLE public.withdraw_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  min_amount NUMERIC NOT NULL DEFAULT 20,
  max_amount NUMERIC NOT NULL DEFAULT 10000,
  custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.withdraw_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active withdraw methods"
  ON public.withdraw_methods FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all withdraw methods"
  ON public.withdraw_methods FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert withdraw methods"
  ON public.withdraw_methods FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update withdraw methods"
  ON public.withdraw_methods FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete withdraw methods"
  ON public.withdraw_methods FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add daily_withdraw_limit to app_settings if not exists
INSERT INTO public.app_settings (key, value) VALUES ('daily_withdraw_limit', '100')
ON CONFLICT (key) DO NOTHING;

-- Updated at trigger
CREATE TRIGGER update_withdraw_methods_updated_at
  BEFORE UPDATE ON public.withdraw_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
