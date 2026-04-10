
-- Insert default password reset email template
INSERT INTO public.email_templates (name, category, transaction_type, trigger_event, subject, body_html, is_active)
VALUES (
  'Password Reset',
  'welcome',
  'password_reset',
  'password_reset',
  'Reset your password for {{site_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#ffffff;">
  <div style="text-align:center;margin-bottom:24px;"><img src="{{logo_url}}" alt="{{site_name}}" style="max-height:60px;max-width:200px;" /></div>
  <h2 style="color:#f5c518;text-align:center;">Reset Your Password</h2>
  <p>Hi {{user_name}},</p>
  <p>We received a request to reset your password for your {{site_name}} account. Click the button below to set a new password.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{confirmation_url}}" style="display:inline-block;padding:14px 40px;background:#f5c518;color:#1a1a2e;text-decoration:none;font-weight:bold;border-radius:8px;font-size:16px;">Reset Password</a>
  </div>
  <p style="color:#aaa;font-size:13px;">Or copy and paste this link: {{confirmation_url}}</p>
  <p style="color:#aaa;font-size:13px;margin-top:16px;">This link will expire in 24 hours. If you didn''t request a password reset, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #333;margin:24px 0;" />
  <p style="font-size:12px;color:#888;text-align:center;">© {{site_name}}</p>
</div>',
  true
);
