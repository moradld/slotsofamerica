
-- Reward history log table
CREATE TABLE public.reward_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_key TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reward_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all reward history
CREATE POLICY "Admins can view reward history"
  ON public.reward_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert reward history
CREATE POLICY "Admins can insert reward history"
  ON public.reward_history FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Managers can view reward history
CREATE POLICY "Managers can view reward history"
  ON public.reward_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Users can view own reward history
CREATE POLICY "Users can view own reward history"
  ON public.reward_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
