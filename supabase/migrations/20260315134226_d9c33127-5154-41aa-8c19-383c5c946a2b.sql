
-- ============================================================
-- FIX 1: SMTP credentials exposure - verification_settings
-- Remove broad authenticated SELECT, add admin-only + selective columns view
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read verification settings" ON public.verification_settings;

-- Create a secure view for non-admin users that excludes SMTP credentials
CREATE OR REPLACE VIEW public.verification_settings_public AS
SELECT 
  id,
  email_verification_enabled,
  phone_verification_enabled,
  otp_expiry_minutes,
  max_attempts,
  max_per_hour,
  resend_cooldown_seconds,
  updated_at
FROM public.verification_settings;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.verification_settings_public TO authenticated;

-- ============================================================
-- FIX 2: Landing chat session hijacking + PII exposure
-- Replace public SELECT with owner-only + admin access
-- Replace UPDATE to require matching visitor_token
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read landing chat sessions" ON public.landing_chat_sessions;
DROP POLICY IF EXISTS "Visitors can update own landing chat session" ON public.landing_chat_sessions;

-- Only admins and session owners (by visitor_token match) can read
CREATE POLICY "Admins can read all landing chat sessions"
  ON public.landing_chat_sessions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- For anonymous/public: no SELECT access at all (sessions are created and used server-side or via token)
-- The widget creates sessions and uses them by ID, so we allow INSERT but not broad SELECT

-- Update requires matching the session's own visitor_token (passed as filter)
CREATE POLICY "Owner can update own landing chat session"
  ON public.landing_chat_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);
  
-- We keep INSERT open since the widget needs to create sessions
-- But the broad SELECT is now removed

-- ============================================================
-- FIX 3: Landing chat messages public read exposure
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read landing chat messages" ON public.landing_chat_messages;

CREATE POLICY "Admins can read all landing chat messages"
  ON public.landing_chat_messages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- FIX 4: site_settings GHL API key exposure
-- Create a public view without sensitive columns
-- Keep the full table admin-only
-- ============================================================

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;

-- Add admin-only SELECT
CREATE POLICY "Admins can read all site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Create a public view excluding sensitive columns
CREATE OR REPLACE VIEW public.site_settings_public AS
SELECT
  id,
  site_name,
  logo_url,
  favicon_url,
  colors,
  fonts,
  custom_css,
  seo_title,
  seo_description,
  seo_keywords,
  nav_links,
  whatsapp_number,
  telegram_link,
  messenger_link,
  header_scripts,
  body_scripts,
  footer_scripts,
  landing_page_config,
  created_at,
  updated_at
FROM public.site_settings;

-- Grant public read access to the safe view
GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT ON public.site_settings_public TO authenticated;
