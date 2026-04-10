
-- 1. Create a sanitization function for landing chat messages
-- Strips HTML tags and script content to prevent XSS/injection
CREATE OR REPLACE FUNCTION public.sanitize_landing_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strip HTML tags from body
  NEW.body := regexp_replace(NEW.body, '<[^>]*>', '', 'g');
  -- Strip common injection patterns
  NEW.body := regexp_replace(NEW.body, 'javascript:', '', 'gi');
  NEW.body := regexp_replace(NEW.body, 'on\w+\s*=', '', 'gi');
  -- Trim whitespace
  NEW.body := trim(NEW.body);
  
  -- Reject if empty after sanitization
  IF length(NEW.body) = 0 THEN
    RAISE EXCEPTION 'Message body cannot be empty';
  END IF;
  
  -- Force direction to inbound for non-admin inserts
  IF NOT has_role(auth.uid(), 'admin') THEN
    NEW.direction := 'inbound';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_landing_chat_message_trigger
  BEFORE INSERT ON public.landing_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_landing_chat_message();

-- 2. Also sanitize landing chat session names to prevent injection
CREATE OR REPLACE FUNCTION public.sanitize_landing_chat_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.name := regexp_replace(trim(NEW.name), '<[^>]*>', '', 'g');
  IF NEW.email IS NOT NULL THEN
    NEW.email := trim(NEW.email);
  END IF;
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(trim(NEW.phone), '[^0-9+\-() ]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_landing_chat_session_trigger
  BEFORE INSERT ON public.landing_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_landing_chat_session();

-- 3. Protect site_settings sensitive columns from non-admin reads
-- The site_settings_public view already excludes ghl_api_key, ghl_location_id, ghl_assigned_user_id
-- But ensure the base table cannot be read by non-admin roles at all
-- (Already enforced - only admin SELECT policy exists on site_settings)

-- Add a trigger to protect sensitive site_settings columns from accidental exposure
CREATE OR REPLACE FUNCTION public.protect_site_settings_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins should be updating site_settings, but add defense-in-depth
  IF current_setting('role', true) = 'authenticated' AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can modify site settings';
  END IF;
  
  -- Validate that API keys aren't being set to obviously invalid values
  IF NEW.ghl_api_key IS NOT NULL AND length(NEW.ghl_api_key) < 10 THEN
    RAISE EXCEPTION 'Invalid API key format';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_site_settings_secrets_trigger
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_site_settings_secrets();
