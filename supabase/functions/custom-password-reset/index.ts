import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      console.error("[custom-password-reset] Missing required environment variables");
      return errorResponse("Server configuration error. Please contact support.", 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body");
    }

    const { email, redirectTo } = body as { email?: string; redirectTo?: string };

    if (!email) {
      return errorResponse("Email is required");
    }

    const anonClient = createClient(supabaseUrl, anonKey);
    await anonClient.auth.resetPasswordForEmail(email as string, {
      redirectTo: (redirectTo as string) || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in custom-password-reset:", error);
    return errorResponse(message, 500);
  }
});
