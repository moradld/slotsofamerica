-- Add email column to profiles for username-based login lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Create index on email for fast lookups  
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Update existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Create or replace trigger to auto-set email on profile creation
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_profile_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();