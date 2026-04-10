
-- Recreate view WITHOUT security_invoker so it bypasses base table RLS
-- This is safe because the view already excludes sensitive columns (ghl_api_key)
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
  SELECT 
    id, site_name, logo_url, favicon_url, colors, fonts, custom_css,
    seo_title, seo_description, seo_keywords,
    landing_page_config, nav_links,
    header_scripts, body_scripts, footer_scripts,
    messenger_link, telegram_link, whatsapp_number,
    created_at, updated_at
  FROM public.site_settings;

-- Grant access to anon and authenticated
GRANT SELECT ON public.site_settings_public TO anon, authenticated;
