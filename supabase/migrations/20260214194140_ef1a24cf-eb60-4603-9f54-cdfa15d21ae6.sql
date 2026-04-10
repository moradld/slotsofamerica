
-- Site settings: single-row configuration table
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Brand
  logo_url TEXT,
  favicon_url TEXT,
  site_name TEXT DEFAULT 'GameVault',
  -- Colors (JSON object with key-value pairs of CSS variable name -> HSL value)
  colors JSONB DEFAULT '{}'::jsonb,
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  -- Scripts
  header_scripts TEXT DEFAULT '',
  body_scripts TEXT DEFAULT '',
  footer_scripts TEXT DEFAULT '',
  -- Custom CSS
  custom_css TEXT DEFAULT '',
  -- Navigation links: array of {label, href, visible}
  nav_links JSONB DEFAULT '[]'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read site settings (needed to render the site)
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.site_settings (site_name) VALUES ('GameVault');

-- Storage bucket for brand assets
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view brand assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Admins can upload brand assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update brand assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete brand assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'admin'::app_role));
