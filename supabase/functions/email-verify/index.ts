import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmtpEmail } from "../_shared/smtp.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 3;
const RESEND_COOLDOWN_SECONDS = 60;

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function hashOtp(otp: string): Promise<string> {
  const data = new TextEncoder().encode(otp);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hash)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("[email-verify] Missing required environment variables");
      return errorResponse("Server configuration error. Please contact support.", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();

    if (authErr || !user) {
      return errorResponse("Not authenticated", 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body");
    }

    const { action, otp } = body as { action?: string; otp?: string };

    // Load SMTP settings from verification_settings
    const { data: vs } = await supabaseAdmin
      .from("verification_settings").select("smtp_host, smtp_port, smtp_email, smtp_password").limit(1).maybeSingle();
    const smtpHost = vs?.smtp_host || "";
    const smtpPort = vs?.smtp_port || 465;
    const smtpEmail = vs?.smtp_email || "";
    const smtpPassword = vs?.smtp_password || "";
    const smtpConfigured = !!(smtpHost && smtpEmail && smtpPassword);

    // === SEND OTP ===
    if (action === "send_otp") {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("email_verified, email").eq("id", user.id).single();
      if (profile?.email_verified) {
        return errorResponse("Email already verified");
      }

      const userEmail = profile?.email || user.email;
      if (!userEmail) {
        return errorResponse("No email found for your account");
      }

      // Rate limit: max per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("otp_verifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("type", "email").gte("created_at", oneHourAgo);
      if ((count || 0) >= MAX_PER_HOUR) {
        return errorResponse("Too many OTP requests this hour. Please try again later.", 429);
      }

      // Resend cooldown
      const cooldownAgo = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
      const { count: recentCount } = await supabaseAdmin
        .from("otp_verifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("type", "email").gte("created_at", cooldownAgo);
      if ((recentCount || 0) > 0) {
        return errorResponse("Please wait before requesting another code.", 429);
      }

      // Invalidate previous
      await supabaseAdmin.from("otp_verifications")
        .update({ verified: true })
        .eq("user_id", user.id).eq("type", "email").eq("verified", false);

      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const otpHashed = await hashOtp(otpCode);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      // Store hashed OTP
      await supabaseAdmin.from("otp_verifications").insert({
        user_id: user.id, type: "email", contact: userEmail,
        otp_hash: otpHashed, expires_at: expiresAt,
      });

      // Send via SMTP
      if (smtpConfigured) {
        try {
          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #333; text-align: center;">Email Verification</h2>
              <p style="color: #666; text-align: center;">Your verification code is:</p>
              <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #222;">${otpCode}</span>
              </div>
              <p style="color: #999; font-size: 12px; text-align: center;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
            </div>
          `;
          await sendSmtpEmail(smtpHost, smtpPort, smtpEmail, smtpPassword, userEmail, "Your Verification Code", htmlBody);
          console.log(`[email-verify] OTP sent via SMTP to ${userEmail}`);
          return new Response(
            JSON.stringify({ success: true, message: "Verification code sent to your email", sent_via_email: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (emailErr) {
          console.error("[email-verify] SMTP send failed:", emailErr);
          return errorResponse("Failed to send verification email. Please check SMTP settings or try again.", 500);
        }
      }

      // No SMTP — return error (SMTP must be configured)
      return errorResponse("Email sending is not configured. Please contact support.", 500);
    }

    // === VERIFY OTP ===
    if (action === "verify_otp") {
      if (!otp || typeof otp !== "string" || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return errorResponse("Valid 6-digit OTP code required");
      }

      const { data: verification } = await supabaseAdmin
        .from("otp_verifications").select("*")
        .eq("user_id", user.id).eq("type", "email").eq("verified", false)
        .order("created_at", { ascending: false }).limit(1).single();

      if (!verification) {
        return errorResponse("No pending verification found. Please request a new code.");
      }

      if (new Date(verification.expires_at) < new Date()) {
        return errorResponse("OTP expired. Please request a new code.");
      }

      if (verification.attempts >= MAX_ATTEMPTS) {
        return errorResponse("Too many attempts. Please request a new code.");
      }

      // Increment attempts
      await supabaseAdmin.from("otp_verifications")
        .update({ attempts: verification.attempts + 1 }).eq("id", verification.id);

      // Compare hash
      const inputHash = await hashOtp(otp);
      if (verification.otp_hash !== inputHash) {
        if (verification.attempts + 1 >= MAX_ATTEMPTS) {
          await supabaseAdmin.rpc("log_security_event", {
            _event_type: "otp_max_attempts_email",
            _user_id: user.id,
            _details: { contact: verification.contact, attempts: verification.attempts + 1 },
            _severity: "high",
          });
        }
        return errorResponse("Invalid OTP code");
      }

      // Mark verified
      await supabaseAdmin.from("otp_verifications")
        .update({ verified: true }).eq("id", verification.id);

      await supabaseAdmin.from("profiles").update({
        email_verified: true, email_verified_at: new Date().toISOString(),
      }).eq("id", user.id);

      // Check for reward
      const { data: rewardConfig } = await supabaseAdmin
        .from("rewards_config").select("value, is_active")
        .eq("key", "email_verification_reward").single();

      let rewarded = 0;
      if (rewardConfig?.is_active && rewardConfig.value > 0) {
        rewarded = Number(rewardConfig.value);
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles").select("balance").eq("id", user.id).single();
        await supabaseAdmin.from("profiles")
          .update({ balance: (currentProfile?.balance || 0) + rewarded }).eq("id", user.id);
        await supabaseAdmin.from("notifications").insert({
          user_id: user.id,
          title: "Email Verified! 🎉",
          message: `Your email has been verified. $${rewarded.toFixed(2)} has been added to your balance!`,
          type: "success", category: "system",
        });
      }

      return new Response(
        JSON.stringify({ success: true, rewarded, message: "Email verified successfully!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse("Unknown action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("email-verify error:", error);
    return errorResponse(message, 500);
  }
});
