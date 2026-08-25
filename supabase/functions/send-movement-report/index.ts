// Daily / weekly AI movement report.
// Cron ticks this every minute with an empty body; the UI calls it with { schedule_id }
// to send immediately, or { tenant_id, timeframe, preview: true } to render HTML only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const phaseLabels: Record<string, string> = {
  mint: "MINT",
  integration: "Integration",
  ms: "MS",
  completed: "Completed",
};
const stateLabels: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  blocked: "Blocked",
  live: "Live",
};

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const formatArr = (arr: number | null | undefined) => {
  if (arr == null || isNaN(Number(arr)) || Number(arr) === 0) return "TBD";
  return `${Number(arr).toFixed(2)} Cr`;
};
const formatDate = (d: string | null | undefined) => {
  if (!d) return "TBD";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "TBD" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

type Entry = { category: string; description: string; timestamp: string; changes?: any[] };

const LOWLIGHT_KW = /\b(no update|no response|unresponsive|following up|awaiting response|chasing|reminder sent|still waiting|no eta)\b/i;
const WIN_KW = /\b(resolved|unblocked|cleared|sign(ed)?[- ]off|approved|pg done|sandbox cleared|validated|completed)\b/i;

function classify(p: any, entries: Entry[]): "wins" | "updates" | "lowlights" {
  if (p.project_state === "blocked" || p.project_state === "on_hold") return "lowlights";
  if (!entries || entries.length === 0) return "lowlights";
  const text = entries.map((e) => e.description).join(" ");
  if (LOWLIGHT_KW.test(text)) return "lowlights";
  if (p.project_state === "live") return "wins";
  if (entries.some((e) => e.category === "checklist")) return "wins";
  if (WIN_KW.test(text)) return "wins";
  return "updates";
}

function buildSummary(entries: Entry[], max = 2): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const e of entries) {
    const d = (e.description || "").replace(/\s+/g, " ").trim();
    if (!d || seen.has(d.toLowerCase())) continue;
    seen.add(d.toLowerCase());
    parts.push(d);
    if (parts.length >= max) break;
  }
  let out = parts.join("; ");
  if (out.length > 320) out = out.slice(0, 317) + "...";
  return out;
}

async function aiSummarise(items: any[], timeframe: string) {
  const aiMap: Record<string, { line1: string; line2: string }> = {};
  if (!LOVABLE_API_KEY || items.length === 0) return aiMap;

  const systemPrompt = `You are a delivery status analyst. You receive recent project activity (checklist updates, comments, phase/state changes) from the last ${timeframe === "daily" ? "24 hours" : "7 days"} for several merchant onboarding projects.

For EACH project, produce:
1. "line1": ONE sentence describing what actually happened this period (project context only — never name people).
2. "line2": ONE sentence on what is next OR what is blocking, with owner/ETA if known.

Rules:
- Be specific and substantive. Mention real things: APIs, sandbox, PG, checklout UI, dashboards, sign-offs.
- Never write generic filler like "work is ongoing".
- If there is no activity, line1 = "No activity recorded this period." and line2 should suggest a nudge or escalation.
- Keep each line under 160 characters.
Return ONLY the tool call.`;

  const userContent = items
    .map((it) => {
      const entriesTxt = (it.entries || []).slice(0, 25).map((e: Entry) => `- [${e.category}] ${e.description}`).join("\n")
        || "- (no activity captured)";
      return `### ${it.merchantName} (id:${it.id})
Phase: ${it.phase} | State: ${it.projectState} | ARR: ${it.arr} | Expected go-live: ${it.egl}
Recent activity:
${entriesTxt}`;
    })
    .join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_movement_summary",
          description: "Return a two-line summary per project",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    line1: { type: "string" },
                    line2: { type: "string" },
                  },
                  required: ["id", "line1", "line2"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_movement_summary" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`AI gateway error [${res.status}]: ${body}`);
    if (res.status === 402 || res.status === 403) throw new Error(`AI unavailable (${res.status}): ${body}`);
    return aiMap;
  }
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (args) {
    try {
      for (const r of (JSON.parse(args).results || [])) aiMap[r.id] = { line1: r.line1, line2: r.line2 };
    } catch (e) {
      console.error("Failed to parse AI arguments", e);
    }
  }
  return aiMap;
}

async function generateReportHtml(supa: any, tenantId: string, timeframe: "daily" | "weekly", title: string) {
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);
  const y = nowIst.getUTCFullYear(), m = nowIst.getUTCMonth(), d = nowIst.getUTCDate();
  const daysSinceMon = (nowIst.getUTCDay() + 6) % 7;
  const startToday = Date.UTC(y, m, d) - IST_OFFSET_MS;
  const startWeek = startToday - daysSinceMon * 86400_000;
  const since = new Date(timeframe === "daily" ? startToday : startWeek).toISOString();

  const windowLabel = timeframe === "daily"
    ? `Today (IST) · ${new Date(Date.UTC(y, m, d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
    : `This week (Mon–today IST) · ${new Date(startWeek + IST_OFFSET_MS).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(Date.UTC(y, m, d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  const { data: projects = [] } = await supa.from("projects").select("*").eq("tenant_id", tenantId);
  const projectIds = (projects || []).map((p: any) => p.id);

  const { data: activityLogs = [] } = await supa
    .from("activity_logs")
    .select("entity_id, entity_type, entity_name, action, details, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const { data: checklistItems = [] } = projectIds.length
    ? await supa.from("checklist_items").select("id, project_id, title, completed, completed_at, sort_order")
        .in("project_id", projectIds)
    : { data: [] };

  const itemMap: Record<string, { project_id: string; title: string }> = Object.fromEntries(
    (checklistItems || []).map((i: any) => [i.id, { project_id: i.project_id, title: i.title }]),
  );

  const { data: checklistComments = [] } = await supa
    .from("checklist_comments")
    .select("checklist_item_id, comment, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const entries: Record<string, Entry[]> = {};
  const push = (pid: string, e: Entry) => { (entries[pid] ||= []).push(e); };

  for (const l of activityLogs || []) {
    if (l.entity_type !== "project" && l.entity_type !== "checklist_item") continue;
    const pid = l.entity_type === "project" ? l.entity_id : itemMap[l.entity_id]?.project_id;
    if (!pid) continue;
    const detail = l.details && typeof l.details === "object"
      ? Object.entries(l.details).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";
    push(pid, {
      category: l.entity_type === "checklist_item" ? "checklist" : "project",
      description: `${l.action}${l.entity_name ? ` — ${l.entity_name}` : ""}${detail ? ` (${detail})` : ""}`,
      timestamp: l.created_at,
      changes: (l.details as any)?.changes,
    });
  }
  for (const c of checklistComments || []) {
    const it = itemMap[c.checklist_item_id];
    if (!it) continue;
    push(it.project_id, {
      category: "checklist",
      description: `Comment on "${it.title}": ${c.comment}`,
      timestamp: c.created_at,
    });
  }
  for (const it of checklistItems || []) {
    if (it.completed && it.completed_at && it.completed_at >= since) {
      push(it.project_id, {
        category: "checklist",
        description: `Completed checklist step "${it.title}"`,
        timestamp: it.completed_at,
      });
    }
  }

  const active = (projects || []).filter(
    (p: any) => (entries[p.id]?.length ?? 0) > 0 || p.project_state === "blocked",
  );

  const aiMap = await aiSummarise(
    active.map((p: any) => ({
      id: p.id,
      merchantName: p.merchant_name,
      phase: phaseLabels[p.current_phase] || p.current_phase,
      projectState: stateLabels[p.project_state] || p.project_state,
      arr: formatArr(p.arr),
      egl: formatDate(p.expected_go_live_date || p.go_live_date),
      entries: (entries[p.id] || []).slice(0, 25),
    })),
    timeframe,
  );

  const buckets: Record<"wins" | "updates" | "lowlights", any[]> = { wins: [], updates: [], lowlights: [] };
  for (const p of active) buckets[classify(p, entries[p.id] || [])].push(p);

  const renderLine = (p: any) => {
    const ai = aiMap[p.id];
    const line1 = ai?.line1 || buildSummary(entries[p.id] || [], 2) || "No specific updates captured this period.";
    const line2 = ai?.line2 || "";
    return `<div style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;line-height:1.5;color:#1e293b;">
      <div><strong style="font-size:14px;">${escapeHtml(p.merchant_name)}</strong></div>
      <div style="color:#475569;font-size:12px;margin:2px 0 6px;">ARR: <strong>${escapeHtml(formatArr(p.arr))}</strong> &nbsp;|&nbsp; Go-live: <strong>${escapeHtml(formatDate(p.expected_go_live_date || p.go_live_date))}</strong> &nbsp;|&nbsp; ${escapeHtml(phaseLabels[p.current_phase] || p.current_phase)} · ${escapeHtml(stateLabels[p.project_state] || p.project_state)}</div>
      <div>${escapeHtml(line1)}</div>
      ${line2 ? `<div style="color:#475569;margin-top:2px;">${escapeHtml(line2)}</div>` : ""}
    </div>`;
  };

  const section = (label: string, color: string, list: any[], empty: string) =>
    `<div style="margin-bottom:24px;">
      <h2 style="font-size:15px;margin:0 0 8px;padding:6px 10px;background:${color};color:#fff;border-radius:4px;display:inline-block;">${label} (${list.length})</h2>
      ${list.length === 0 ? `<p style="color:#94a3b8;font-size:13px;">${empty}</p>` : list.map(renderLine).join("")}
    </div>`;

  const blocked = (projects || []).filter((p: any) => p.project_state === "blocked");

  let html = `<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1e293b;">`;
  html += `<h1 style="margin:0 0 4px;font-size:20px;">${escapeHtml(title)}</h1>`;
  html += `<p style="margin:0 0 14px;color:#64748b;font-size:12px;">${escapeHtml(windowLabel)} · Generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}</p>`;
  html += `<div style="background:#f1f5f9;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:20px;">
    <strong>${(projects || []).length}</strong> projects · <strong style="color:#059669;">${active.length}</strong> with movement · <strong style="color:#dc2626;">${blocked.length}</strong> blocked
  </div>`;

  if (blocked.length > 0) {
    html += `<div style="margin-bottom:26px;border:2px solid #dc2626;border-radius:8px;overflow:hidden;">
      <h2 style="font-size:14px;margin:0;padding:10px 14px;background:#dc2626;color:#fff;">BLOCKED · ${blocked.length} project${blocked.length === 1 ? "" : "s"} need attention</h2>
      <div style="padding:6px 14px 12px;background:#fef2f2;">${blocked.map(renderLine).join("")}</div>
    </div>`;
  }

  html += section("Wins", "#059669", buckets.wins, "No new wins this period.");
  html += section("Updates", "#2563eb", buckets.updates, "No active updates this period.");
  html += section("Lowlights", "#dc2626", buckets.lowlights, "No lowlights this period.");
  html += `</div>`;
  return html;
}

async function sendOne(supa: any, schedule: any) {
  const exec = await supa.from("movement_report_executions").insert({
    schedule_id: schedule.id,
    tenant_id: schedule.tenant_id,
    status: "sending",
    recipients: schedule.recipients,
  }).select().single();
  const execId = exec.data?.id;

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
    if (!schedule.recipients?.length) throw new Error("No recipients configured");
    const title = `${schedule.timeframe === "daily" ? "Daily" : "Weekly"} Movement Report`;
    const subject = `${schedule.subject_prefix ? schedule.subject_prefix + " " : ""}${title} — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`;
    const html = await generateReportHtml(supa, schedule.tenant_id, schedule.timeframe, title);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Handover Updates <onboarding@resend.dev>",
        to: schedule.recipients,
        subject,
        html,
      }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.message || "Resend failed");

    await supa.from("movement_report_executions").update({
      status: "success", email_count: schedule.recipients.length, completed_at: new Date().toISOString(),
    }).eq("id", execId);
    await supa.from("movement_report_schedules").update({ last_sent_at: new Date().toISOString() }).eq("id", schedule.id);
    return { ok: true };
  } catch (e: any) {
    const message = String(e?.message || e);
    await supa.from("movement_report_executions").update({
      status: "failed", error_message: message, completed_at: new Date().toISOString(),
    }).eq("id", execId);
    return { ok: false, error: message };
  }
}

function isDue(schedule: any, nowIst: Date): boolean {
  if (!schedule.enabled) return false;
  const [hh, mm] = (schedule.time_ist || "09:00").split(":").map(Number);
  if (nowIst.getUTCHours() !== hh || nowIst.getUTCMinutes() !== mm) return false;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][nowIst.getUTCDay()];
  if (!schedule.days?.includes(dow)) return false;
  if (schedule.last_sent_at && Date.now() - new Date(schedule.last_sent_at).getTime() < 5 * 60 * 1000) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    let body: any = {};
    try { body = await req.json(); } catch { /* cron sends empty */ }

    if (body.preview && body.tenant_id) {
      const timeframe = body.timeframe === "weekly" ? "weekly" : "daily";
      const html = await generateReportHtml(
        supa, body.tenant_id, timeframe,
        `${timeframe === "daily" ? "Daily" : "Weekly"} Movement Report`,
      );
      return json({ html });
    }

    if (body.schedule_id) {
      const { data: s, error } = await supa.from("movement_report_schedules").select("*").eq("id", body.schedule_id).single();
      if (error || !s) throw new Error(error?.message || "Schedule not found");
      const r = await sendOne(supa, s);
      return json(r, r.ok ? 200 : 500);
    }

    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const { data: schedules } = await supa.from("movement_report_schedules").select("*").eq("enabled", true);
    const due = (schedules || []).filter((s: any) => isDue(s, nowIst));
    const results = await Promise.all(due.map((s: any) => sendOne(supa, s)));
    return json({ processed: due.length, results });
  } catch (e: any) {
    console.error("send-movement-report error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
