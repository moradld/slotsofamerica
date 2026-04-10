
-- Add name and category columns for flexible email templates
ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transaction';

-- Update existing templates to have names based on transaction_type
UPDATE public.email_templates SET name = initcap(transaction_type) || ' Notification' WHERE name IS NULL;

-- Make name NOT NULL after backfill
ALTER TABLE public.email_templates ALTER COLUMN name SET NOT NULL;
