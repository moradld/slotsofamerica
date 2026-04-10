
-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed by edge function with service role, but also for admin UI)
CREATE POLICY "Admins can view email templates"
ON public.email_templates FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email templates"
ON public.email_templates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email templates"
ON public.email_templates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email templates"
ON public.email_templates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates with placeholders: {{user_name}}, {{amount}}, {{type}}, {{status}}, {{site_name}}, {{date}}
INSERT INTO public.email_templates (transaction_type, subject, body_html) VALUES
('deposit', '{{site_name}} - Deposit Request Submitted', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0d1117;color:#e6edf3;border-radius:12px;"><h2 style="color:#4f8ff7;">Deposit Request Submitted</h2><p>Hi {{user_name}},</p><p>Your deposit request of <strong>${{amount}}</strong> has been submitted successfully.</p><p><strong>Status:</strong> {{status}}</p><p><strong>Date:</strong> {{date}}</p><p>We will process your request shortly. You will be notified once it is approved.</p><hr style="border-color:#21262d;"/><p style="color:#8b949e;font-size:12px;">© {{site_name}}. All rights reserved.</p></div>'),
('withdraw', '{{site_name}} - Withdrawal Request Submitted', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0d1117;color:#e6edf3;border-radius:12px;"><h2 style="color:#f0883e;">Withdrawal Request Submitted</h2><p>Hi {{user_name}},</p><p>Your withdrawal request of <strong>${{amount}}</strong> has been submitted successfully.</p><p><strong>Status:</strong> {{status}}</p><p><strong>Date:</strong> {{date}}</p><p>We will process your request shortly.</p><hr style="border-color:#21262d;"/><p style="color:#8b949e;font-size:12px;">© {{site_name}}. All rights reserved.</p></div>'),
('transfer', '{{site_name}} - Transfer Completed', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0d1117;color:#e6edf3;border-radius:12px;"><h2 style="color:#4f8ff7;">Transfer Request Submitted</h2><p>Hi {{user_name}},</p><p>Your transfer of <strong>${{amount}}</strong> has been submitted.</p><p><strong>Status:</strong> {{status}}</p><p><strong>Date:</strong> {{date}}</p><hr style="border-color:#21262d;"/><p style="color:#8b949e;font-size:12px;">© {{site_name}}. All rights reserved.</p></div>'),
('redeem', '{{site_name}} - Redeem Request Submitted', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0d1117;color:#e6edf3;border-radius:12px;"><h2 style="color:#a371f7;">Redeem Request Submitted</h2><p>Hi {{user_name}},</p><p>Your redeem request of <strong>${{amount}}</strong> has been submitted successfully.</p><p><strong>Status:</strong> {{status}}</p><p><strong>Date:</strong> {{date}}</p><p>We will review and process your request shortly.</p><hr style="border-color:#21262d;"/><p style="color:#8b949e;font-size:12px;">© {{site_name}}. All rights reserved.</p></div>');
