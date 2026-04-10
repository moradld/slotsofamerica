import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmtpEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("[send-test-email] Missing required environment variables");
      return errorResponse("Server configuration error. Please contact support.", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization", 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "manager")) {
      return errorResponse("Admin access required", 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body");
    }

    const { to_email, subject, body_html } = body as {
      to_email?: string; subject?: string; body_html?: string;
    };

    if (!to_email || !subject || !body_html) {
      return errorResponse("Missing to_email, subject, or body_html");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to_email as string)) {
      return errorResponse("Invalid email address");
    }

    const { data: siteSettings } = await adminClient
      .from("site_settings")
      .select("site_name")
      .limit(1)
      .maybeSingle();

    const siteName = siteSettings?.site_name || "MySite";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{user_name\}\}/g, "John Doe")
        .replace(/\{\{email\}\}/g, to_email as string)
        .replace(/\{\{amount\}\}/g, "50.00")
        .replace(/\{\{type\}\}/g, "deposit")
        .replace(/\{\{status\}\}/g, "Approved")
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{game_name\}\}/g, "Slots Master");

    const finalSubject = `[TEST] ${replacePlaceholders(subject as string)}`;
    const finalHtml = replacePlaceholders(body_html as string);

    // Load SMTP settings
    const { data: vs } = await adminClient
      .from("verification_settings").select("smtp_host, smtp_port, smtp_email, smtp_password").limit(1).maybeSingle();
    const smtpHost = vs?.smtp_host || "";
    const smtpPort = vs?.smtp_port || 465;
    const smtpEmail = vs?.smtp_email || "";
    const smtpPassword = vs?.smtp_password || "";
    const smtpConfigured = !!(smtpHost && smtpEmail && smtpPassword);

    if (smtpConfigured) {
      try {
        await sendSmtpEmail(smtpHost, smtpPort, smtpEmail, smtpPassword, to_email as string, finalSubject, finalHtml);
        console.log(`[send-test-email] Sent via SMTP to ${to_email}`);
      } catch (smtpErr) {
        console.error("[send-test-email] SMTP failed:", smtpErr);
        const errMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        return errorResponse(`SMTP error: ${errMsg}`, 500);
      }
    } else {
      console.warn(`[send-test-email] SMTP not configured. Cannot send test email.`);
      return errorResponse("SMTP is not configured. Please set up SMTP in Verification settings first.");
    }

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent to ${to_email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error sending test email:", error);
    return errorResponse(message, 500);
  }
});
