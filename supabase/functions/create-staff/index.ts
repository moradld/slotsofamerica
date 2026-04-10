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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKeyEnv = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKeyEnv) {
      console.error("[create-staff] Missing required environment variables");
      return errorResponse("Server configuration error. Please contact support.", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization", 401);
    }

    // Verify the calling user is an admin
    const callerClient = createClient(supabaseUrl, anonKeyEnv, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return errorResponse("Not authenticated", 401);
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return errorResponse("Only admins can create staff accounts", 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body");
    }

    const { email, password, username, role } = body as {
      email?: string; password?: string; username?: string; role?: string;
    };

    if (!email || !password || !username || !role) {
      return errorResponse("Missing required fields");
    }

    if (!["admin", "manager"].includes(role)) {
      return errorResponse("Invalid role");
    }

    if ((password as string).length < 6) {
      return errorResponse("Password must be at least 6 characters");
    }

    // Create user with service role (doesn't affect caller's session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email as string,
      password: password as string,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createError) {
      return errorResponse(createError.message);
    }

    const newUserId = newUser.user.id;

    // Create profile (since trigger may not exist)
    await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        username,
        display_name: username,
        email,
      }, { onConflict: "id" });

    // Create or update role
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (existingRole) {
      await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", newUserId);
    } else {
      await adminClient
        .from("user_roles")
        .insert({ user_id: newUserId, role });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in create-staff:", error);
    return errorResponse(message, 500);
  }
});
