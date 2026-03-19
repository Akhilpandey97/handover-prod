import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TeamRole = "mint" | "integration" | "ms" | "manager" | "super_admin";
const VALID_ROLES: TeamRole[] = ["mint", "integration", "ms", "manager", "super_admin"];

const sanitizeRole = (value: unknown): TeamRole => {
  return typeof value === "string" && VALID_ROLES.includes(value as TeamRole)
    ? (value as TeamRole)
    : "mint";
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

const deriveTenantName = (email: string, name?: string | null) => {
  const domain = email.split("@")[1] || "workspace";
  const company = domain.split(".")[0] || "workspace";
  const normalizedCompany = company.charAt(0).toUpperCase() + company.slice(1);
  return name ? `${normalizedCompany} Workspace` : `${normalizedCompany} Team`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, team, tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, role, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const metadata = user.user_metadata || {};
    const name = existingProfile?.name || metadata.name || user.email?.split("@")[0] || "User";
    const email = existingProfile?.email || user.email || "";
    const role = sanitizeRole(existingRole?.role || metadata.team || existingProfile?.team || "mint");

    let tenantId = existingProfile?.tenant_id || existingRole?.tenant_id || metadata.tenant_id || null;

    if (!tenantId) {
      const tenantName = deriveTenantName(email, name);
      const slugBase = slugify(tenantName) || "workspace";
      const slug = `${slugBase}-${user.id.slice(0, 8)}`;

      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: tenantName,
          slug,
          is_active: true,
        })
        .select("id")
        .single();

      if (tenantError || !tenant) {
        console.error("Failed to create tenant", tenantError);
        return new Response(JSON.stringify({ error: tenantError?.message || "Failed to create workspace" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tenantId = tenant.id;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email,
          name,
          team: role,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("Failed to upsert profile", profileError);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingRole?.id) {
      const { error: roleUpdateError } = await supabaseAdmin
        .from("user_roles")
        .update({ role, tenant_id: tenantId })
        .eq("id", existingRole.id);

      if (roleUpdateError) {
        console.error("Failed to update role", roleUpdateError);
        return new Response(JSON.stringify({ error: roleUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
        user_id: user.id,
        role,
        tenant_id: tenantId,
      });

      if (roleInsertError) {
        console.error("Failed to create role", roleInsertError);
        return new Response(JSON.stringify({ error: roleInsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        name,
        team: role,
        tenant_id: tenantId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email,
          role,
          tenant_id: tenantId,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("bootstrap-user error", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
