
-- Add category column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

-- Allow admins to insert notifications for any user (already exists but let's ensure)
-- Update existing notifications with best-guess categories based on title
UPDATE public.notifications SET category = 
  CASE
    WHEN title ILIKE '%game access%' OR title ILIKE '%game unlock%' THEN 'game_access'
    WHEN title ILIKE '%password%' THEN 'password_request'
    WHEN title ILIKE '%deposit%' OR (title ILIKE '%transaction%' AND message ILIKE '%deposit%') THEN 'deposit'
    WHEN title ILIKE '%transfer%' OR (title ILIKE '%transaction%' AND message ILIKE '%transfer%') THEN 'transfer'
    WHEN title ILIKE '%redeem%' OR (title ILIKE '%transaction%' AND message ILIKE '%redeem%') THEN 'redeem'
    WHEN title ILIKE '%withdraw%' OR (title ILIKE '%transaction%' AND message ILIKE '%withdraw%') THEN 'withdraw'
    WHEN title ILIKE '%low stock%' THEN 'system'
    ELSE 'other'
  END;
