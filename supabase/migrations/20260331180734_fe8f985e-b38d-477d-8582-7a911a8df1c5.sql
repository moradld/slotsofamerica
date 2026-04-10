
CREATE TABLE public.support_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'MessageCircle',
  link text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;

-- Anyone can view active channels (public-facing widget)
CREATE POLICY "Anyone can view active support channels"
ON public.support_channels FOR SELECT TO public
USING (is_active = true);

-- Admins full access
CREATE POLICY "Admins can manage support channels"
ON public.support_channels FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
