
-- ============================================================
-- 1. PROFILES PROTECTION TRIGGER
-- Block direct updates to sensitive columns (balance, email_verified, phone_verified)
-- Only SECURITY DEFINER functions (service role) can modify these
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If called from a security definer function, the session user context
  -- won't have auth.uid(). We allow changes when current_setting indicates
  -- a trusted context (service role), otherwise block sensitive column changes.
  
  -- Check if this is a direct user update (not from a security definer RPC)
  -- by seeing if the caller role is 'authenticated' (not 'service_role')
  IF current_setting('role', true) = 'authenticated' THEN
    -- Block balance changes
    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'Direct balance modification is not allowed. Use server-side functions.';
    END IF;
    
    -- Block email_verified changes
    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
      RAISE EXCEPTION 'Direct email_verified modification is not allowed.';
    END IF;
    
    -- Block phone_verified changes  
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Direct phone_verified modification is not allowed.';
    END IF;
    
    -- Block email_verified_at changes
    IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'Direct email_verified_at modification is not allowed.';
    END IF;
    
    -- Block phone_verified_at changes
    IF NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at THEN
      RAISE EXCEPTION 'Direct phone_verified_at modification is not allowed.';
    END IF;
    
    -- Block email_verified_by_admin changes
    IF NEW.email_verified_by_admin IS DISTINCT FROM OLD.email_verified_by_admin THEN
      RAISE EXCEPTION 'Direct email_verified_by_admin modification is not allowed.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_sensitive_cols ON public.profiles;
CREATE TRIGGER protect_profiles_sensitive_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_columns();

-- ============================================================
-- 2. SECURITY EVENTS TABLE
-- Track suspicious activity: OTP failures, rapid transactions, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  ip_address text,
  details jsonb DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'warning',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert security events"
  ON public.security_events FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow service role inserts (edge functions use service role)
-- No public insert/update/delete

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);

-- ============================================================
-- 3. TIGHTEN VERIFICATION TABLES RLS
-- verification_codes: remove user SELECT, only admin and service role
-- phone_verifications: remove user SELECT, only admin and service role
-- ============================================================

-- verification_codes: drop user-facing SELECT policy
DROP POLICY IF EXISTS "Users can view own verification codes" ON public.verification_codes;

-- phone_verifications: drop user-facing policies
DROP POLICY IF EXISTS "Users can view own verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Users can insert own verifications" ON public.phone_verifications;

-- Add admin-only policies for phone_verifications
CREATE POLICY "Admins can view phone verifications"
  ON public.phone_verifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. REVOKE DEFAULT PRIVILEGES
-- Ensure anon/authenticated cannot bypass RLS
-- ============================================================

-- Revoke all default privileges on public schema for anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- ============================================================
-- 5. ADDITIONAL PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_type ON public.otp_verifications(user_id, type, verified);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id, created_at DESC);

-- ============================================================
-- 6. SECURITY EVENT LOGGING FUNCTION
-- Reusable function for edge functions to log security events
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _user_id uuid DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb,
  _severity text DEFAULT 'warning',
  _ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, user_id, ip_address, details, severity)
  VALUES (_event_type, _user_id, _ip_address, _details, _severity);
END;
$$;
