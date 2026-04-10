
-- 1. Recreate site_settings_public view WITHOUT sensitive columns (ghl_api_key, ghl_location_id, ghl_assigned_user_id, ghl_conversation_mode)
DROP VIEW IF EXISTS public.site_settings_public;
CREATE OR REPLACE VIEW public.site_settings_public WITH (security_invoker = on) AS
SELECT 
  id, site_name, logo_url, favicon_url, colors, fonts, custom_css,
  seo_title, seo_description, seo_keywords,
  landing_page_config, nav_links,
  header_scripts, body_scripts, footer_scripts,
  messenger_link, telegram_link, whatsapp_number,
  created_at, updated_at
FROM public.site_settings;

-- Grant SELECT on the public view to anon and authenticated
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- 2. Tighten landing_chat_messages INSERT: add length/content constraints
DROP POLICY IF EXISTS "Anyone can insert landing chat messages" ON public.landing_chat_messages;
CREATE POLICY "Anyone can insert landing chat messages"
  ON public.landing_chat_messages FOR INSERT
  TO public
  WITH CHECK (
    session_id IS NOT NULL
    AND body IS NOT NULL
    AND length(body) > 0
    AND length(body) <= 2000
    AND direction = 'inbound'
  );

-- 3. Tighten landing_chat_sessions INSERT: restrict field lengths to prevent abuse
DROP POLICY IF EXISTS "Anyone can create landing chat session" ON public.landing_chat_sessions;
CREATE POLICY "Anyone can create landing chat session"
  ON public.landing_chat_sessions FOR INSERT
  TO public
  WITH CHECK (
    visitor_token IS NOT NULL
    AND length(visitor_token) <= 100
    AND name IS NOT NULL
    AND length(name) > 0
    AND length(name) <= 200
    AND (email IS NULL OR length(email) <= 320)
    AND (phone IS NULL OR length(phone) <= 30)
  );
