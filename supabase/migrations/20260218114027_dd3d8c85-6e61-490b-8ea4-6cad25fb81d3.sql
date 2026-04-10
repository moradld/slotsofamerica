
-- Insert default verification email template
INSERT INTO public.email_templates (name, category, transaction_type, trigger_event, subject, body_html, is_active)
VALUES (
  'Email Verification',
  'welcome',
  'verification',
  'email_verification',
  'Verify your email for {{site_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#ffffff;">
  <div style="text-align:center;margin-bottom:24px;"><img src="{{logo_url}}" alt="{{site_name}}" style="max-height:60px;max-width:200px;" /></div>
  <h2 style="color:#f5c518;text-align:center;">Verify Your Email</h2>
  <p>Hi {{user_name}},</p>
  <p>Thank you for registering at {{site_name}}! Please verify your email address by clicking the button below.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{confirmation_url}}" style="display:inline-block;padding:14px 40px;background:#f5c518;color:#1a1a2e;text-decoration:none;font-weight:bold;border-radius:8px;font-size:16px;">Verify Email</a>
  </div>
  <p style="color:#aaa;font-size:13px;">Or copy and paste this link: {{confirmation_url}}</p>
  <hr style="border:none;border-top:1px solid #333;margin:24px 0;" />
  <p style="font-size:12px;color:#888;text-align:center;">If you didn''t create an account, you can safely ignore this email.</p>
  <p style="font-size:12px;color:#888;text-align:center;">© {{site_name}}</p>
</div>',
  true
);
