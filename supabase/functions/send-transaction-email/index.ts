import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmtpEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Transaction emails should never crash the calling flow
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("[send-transaction-email] Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, message: "Server configuration error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid request body" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { transaction_type, amount, status = "Pending" } = body as {
      transaction_type?: string; amount?: string; status?: string;
    };

    if (!transaction_type || !amount) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("email_notifications, display_name, username")
      .eq("id", user.id)
      .single();

    if (!profile?.email_notifications) {
      return new Response(JSON.stringify({ success: true, message: "Notifications disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: template } = await adminClient
      .from("email_templates")
      .select("subject, body_html, is_active")
      .eq("transaction_type", transaction_type as string)
      .single();

    if (!template || !template.is_active) {
      return new Response(JSON.stringify({ success: true, message: "Template inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load SMTP settings
    const { data: vs } = await adminClient
      .from("verification_settings").select("smtp_host, smtp_port, smtp_email, smtp_password").limit(1).maybeSingle();
    const smtpHost = vs?.smtp_host || "";
    const smtpPort = vs?.smtp_port || 465;
    const smtpEmail = vs?.smtp_email || "";
    const smtpPassword = vs?.smtp_password || "";
    const smtpConfigured = !!(smtpHost && smtpEmail && smtpPassword);

    const { data: siteSettings } = await adminClient
      .from("site_settings").select("site_name").limit(1).maybeSingle();

    const siteName = siteSettings?.site_name || "Slots of America";
    const userName = profile.display_name || profile.username || user.email?.split("@")[0] || "Player";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{amount\}\}/g, String(amount))
        .replace(/\{\{type\}\}/g, transaction_type as string)
        .replace(/\{\{status\}\}/g, status as string)
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{date\}\}/g, dateStr);

    const emailSubject = replacePlaceholders(template.subject);
    const htmlBody = replacePlaceholders(template.body_html);

    if (smtpConfigured) {
      try {
        await sendSmtpEmail(smtpHost, smtpPort, smtpEmail, smtpPassword, user.email!, emailSubject, htmlBody);
        console.log(`[send-transaction-email] Sent via SMTP to ${user.email}: ${emailSubject}`);
      } catch (smtpErr) {
        console.error("[send-transaction-email] SMTP failed:", smtpErr);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to send email via SMTP" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.warn(`[send-transaction-email] SMTP not configured. Skipping email to ${user.email}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email notification processed", email: user.email, subject: emailSubject }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error sending transaction email:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Email sending failed but transaction is unaffected" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
