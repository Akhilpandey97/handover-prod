import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") || "";
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = typeof body.token === "string" ? body.token : "";
    }

    if (!token || token.length < 8 || token.length > 128) {
      return json({ error: "Invalid portal link" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from("merchant_portal_tokens")
      .select("id, project_id, is_active, expires_at, tenant_id")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow || !tokenRow.is_active) {
      return json({ error: "This portal link is no longer active" }, 404);
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ error: "This portal link has expired" }, 410);
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, merchant_name, platform, current_phase, project_state, go_live_percent, kick_off_date, expected_go_live_date, go_live_date, current_responsibility, current_phase_comment",
      )
      .eq("id", tokenRow.project_id)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return json({ error: "Project not found" }, 404);

    const { data: checklist } = await supabase
      .from("checklist_items")
      .select("id, title, completed, completed_at, phase, current_responsibility, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true });

    const { data: tenant } = tokenRow.tenant_id
      ? await supabase
          .from("tenants")
          .select("name, logo_url")
          .eq("id", tokenRow.tenant_id)
          .maybeSingle()
      : { data: null };

    // Record the visit (best-effort)
    await supabase.from("merchant_portal_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", tokenRow.id);
    await supabase.from("merchant_portal_visits").insert({
      token_id: tokenRow.id,
      project_id: project.id,
      tenant_id: tokenRow.tenant_id,
      user_agent: req.headers.get("user-agent")?.slice(0, 400) || null,
    });

    return json({
      project: {
        merchantName: project.merchant_name,
        platform: project.platform,
        phase: project.current_phase,
        state: project.project_state,
        goLivePercent: project.go_live_percent ?? 0,
        kickOffDate: project.kick_off_date,
        expectedGoLiveDate: project.expected_go_live_date,
        goLiveDate: project.go_live_date,
        waitingOn: project.current_responsibility,
        latestUpdate: project.current_phase_comment,
      },
      checklist: (checklist || []).map((item) => ({
        id: item.id,
        title: item.title,
        completed: Boolean(item.completed),
        completedAt: item.completed_at,
        phase: item.phase,
        waitingOn: item.current_responsibility,
      })),
      brand: { name: tenant?.name || null, logoUrl: tenant?.logo_url || null },
    });
  } catch (error) {
    console.error("merchant-portal-data error:", error);
    return json({ error: "Unable to load portal" }, 500);
  }
});
