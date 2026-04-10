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

  // Trigger emails are non-critical — always return 200 to avoid breaking calling operations
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[trigger-email] Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, message: "Server configuration error" }),
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

    const { event, user_id, data = {} } = body as {
      event?: string; user_id?: string; data?: Record<string, unknown>;
    };

    if (!event || !user_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing event or user_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("email_notifications, display_name, username, email")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, message: "User not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userEmail = profile.email;
    if (!userEmail) {
      const { data: authData } = await adminClient.auth.admin.getUserById(user_id as string);
      userEmail = authData?.user?.email ?? null;
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, message: "No email for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.email_notifications) {
      return new Response(
        JSON.stringify({ success: true, message: "User has email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: templates } = await adminClient
      .from("email_templates")
      .select("*")
      .eq("trigger_event", event as string)
      .eq("is_active", true);

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active templates for this event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    const userName = profile.display_name || profile.username || userEmail.split("@")[0];
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{email\}\}/g, userEmail!)
        .replace(/\{\{amount\}\}/g, String((data as any).amount || "0.00"))
        .replace(/\{\{type\}\}/g, (data as any).type || "")
        .replace(/\{\{status\}\}/g, (data as any).status || "")
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{game_name\}\}/g, (data as any).game_name || "");

    const results: { template: string; sent: boolean; error?: string }[] = [];

    for (const template of templates) {
      const emailSubject = replacePlaceholders(template.subject);
      const html = replacePlaceholders(template.body_html);

      try {
        if (smtpConfigured) {
          await sendSmtpEmail(smtpHost, smtpPort, smtpEmail, smtpPassword, userEmail!, emailSubject, html);
          results.push({ template: template.name, sent: true });
        } else {
          console.warn(`[trigger-email] SMTP not configured. Skipping email for template: ${template.name}`);
          results.push({ template: template.name, sent: false, error: "SMTP not configured" });
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        console.error(`[trigger-email] SMTP send failed for template ${template.name}:`, e);
        results.push({ template: template.name, sent: false, error: errMsg });
      }
    }

    console.log(`Trigger email event="${event}" user="${user_id}":`, results);

    return new Response(
      JSON.stringify({ success: true, event, templates_processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in trigger-email:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Email trigger failed but operation is unaffected" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
