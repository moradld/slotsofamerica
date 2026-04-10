import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
      console.error("[phone-verify] Missing required environment variables");
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

    const { action, phone, otp } = body as { action?: string; phone?: string; otp?: string };

    // === GENERATE OTP (for WhatsApp verification) ===
    if (action === "send_otp") {
      if (!phone || (phone as string).replace(/\D/g, "").length < 10) {
        return errorResponse("Valid phone number required");
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("phone_verified").eq("id", user.id).single();
      if (profile?.phone_verified) {
        return errorResponse("Phone already verified");
      }

      // Rate limit
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("otp_verifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("type", "phone").gte("created_at", oneHourAgo);
      if ((count || 0) >= MAX_PER_HOUR) {
        return errorResponse("Too many OTP requests this hour. Please try again later.", 429);
      }

      // Resend cooldown
      const cooldownAgo = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
      const { count: recentCount } = await supabaseAdmin
        .from("otp_verifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("type", "phone").gte("created_at", cooldownAgo);
      if ((recentCount || 0) > 0) {
        return errorResponse("Please wait before requesting another code.", 429);
      }

      // Invalidate previous
      await supabaseAdmin.from("otp_verifications")
        .update({ verified: true })
        .eq("user_id", user.id).eq("type", "phone").eq("verified", false);

      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const otpHashed = await hashOtp(otpCode);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabaseAdmin.from("otp_verifications").insert({
        user_id: user.id, type: "phone", contact: phone as string,
        otp_hash: otpHashed, expires_at: expiresAt,
      });

      // Save phone to profile
      await supabaseAdmin.from("profiles").update({ phone: phone as string }).eq("id", user.id);

      console.log(`[phone-verify] OTP generated for ${phone}`);

      return new Response(
        JSON.stringify({ success: true, code: otpCode, message: "Send this code to our WhatsApp support number." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === VERIFY OTP ===
    if (action === "verify_otp") {
      if (!otp || typeof otp !== "string" || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return errorResponse("Valid 6-digit OTP code required");
      }

      const { data: verification } = await supabaseAdmin
        .from("otp_verifications").select("*")
        .eq("user_id", user.id).eq("type", "phone").eq("verified", false)
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

      await supabaseAdmin.from("otp_verifications")
        .update({ attempts: verification.attempts + 1 }).eq("id", verification.id);

      const inputHash = await hashOtp(otp);
      if (verification.otp_hash !== inputHash) {
        // Log security event for failed OTP attempt
        if (verification.attempts + 1 >= MAX_ATTEMPTS) {
          await supabaseAdmin.rpc("log_security_event", {
            _event_type: "otp_max_attempts_phone",
            _user_id: user.id,
            _details: { contact: verification.contact, attempts: verification.attempts + 1 },
            _severity: "high",
          });
        }
        return errorResponse("Invalid OTP code");
      }

      await supabaseAdmin.from("otp_verifications")
        .update({ verified: true }).eq("id", verification.id);

      await supabaseAdmin.from("profiles").update({
        phone_verified: true, phone_verified_at: new Date().toISOString(),
      }).eq("id", user.id);

      // Check for reward
      const { data: rewardConfig } = await supabaseAdmin
        .from("rewards_config").select("value, is_active")
        .eq("key", "phone_verification_reward").single();

      let rewarded = 0;
      if (rewardConfig?.is_active && rewardConfig.value > 0) {
        rewarded = Number(rewardConfig.value);
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles").select("balance").eq("id", user.id).single();
        await supabaseAdmin.from("profiles")
          .update({ balance: (currentProfile?.balance || 0) + rewarded }).eq("id", user.id);
        await supabaseAdmin.from("notifications").insert({
          user_id: user.id,
          title: "Phone Verified! 🎉",
          message: `Your phone has been verified. $${rewarded.toFixed(2)} has been added to your balance!`,
          type: "success", category: "system",
        });
      }

      return new Response(
        JSON.stringify({ success: true, rewarded, message: "Phone verified successfully!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REQUEST MANUAL VERIFICATION ===
    if (action === "request_manual") {
      if (!phone || (phone as string).replace(/\D/g, "").length < 10) {
        return errorResponse("Valid phone number required");
      }

      // Check existing pending request
      const { data: existing } = await supabaseAdmin
        .from("manual_verification_requests").select("id")
        .eq("user_id", user.id).eq("type", "phone").eq("status", "pending").maybeSingle();
      if (existing) {
        return errorResponse("You already have a pending manual verification request.");
      }

      await supabaseAdmin.from("profiles").update({ phone: phone as string }).eq("id", user.id);

      await supabaseAdmin.from("manual_verification_requests").insert({
        user_id: user.id, type: "phone", contact: phone as string,
      });

      // Notify admins
      const { data: admins } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", "admin");
      if (admins) {
        for (const admin of admins) {
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.user_id,
            title: "Manual Verification Request",
            message: `A user requested manual phone verification for ${phone}`,
            type: "info", category: "system",
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Manual verification request submitted. An admin will review it shortly." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse("Unknown action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("phone-verify error:", error);
    return errorResponse(message, 500);
  }
});
