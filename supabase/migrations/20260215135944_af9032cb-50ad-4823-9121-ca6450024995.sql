-- Add trigger_event column to email_templates for event-based automation
ALTER TABLE public.email_templates
ADD COLUMN trigger_event text DEFAULT 'manual';

-- Backfill existing transaction templates
UPDATE public.email_templates 
SET trigger_event = CASE 
  WHEN transaction_type = 'deposit' THEN 'transaction_approved_deposit'
  WHEN transaction_type = 'withdraw' THEN 'transaction_approved_withdraw'
  WHEN transaction_type = 'transfer' THEN 'transaction_approved_transfer'
  WHEN transaction_type = 'redeem' THEN 'transaction_approved_redeem'
  ELSE 'manual'
END
WHERE category = 'transaction';
