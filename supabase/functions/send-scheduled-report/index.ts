import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { report_id, tenant_id } = body;

    if (!report_id) throw new Error("report_id is required");

    // Fetch the saved report
    const { data: report, error: reportErr } = await supabase
      .from("saved_reports")
      .select("*")
      .eq("id", report_id)
      .single();

    if (reportErr || !report) throw new Error("Report not found");

    const recipients = report.recipients || [];
    if (recipients.length === 0) throw new Error("No recipients configured for this report");

    // Create execution record
    const { data: execution, error: execErr } = await supabase
      .from("report_executions")
      .insert({
        report_id,
        tenant_id: report.tenant_id || tenant_id,
        status: "sending",
        recipients,
        email_count: recipients.length,
      })
      .select()
      .single();

    if (execErr) {
      console.error("Failed to create execution record:", execErr);
    }

    // Fetch project data for this tenant
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("tenant_id", report.tenant_id || tenant_id)
      .order("created_at", { ascending: false });

    if (projErr) throw new Error("Failed to fetch projects");

    const columns = report.columns || [];
    const columnLabels: Record<string, string> = {
      merchantName: "Merchant Name", mid: "MID", platform: "Platform", category: "Category",
      arr: "ARR", txnsPerDay: "Txns/Day", aov: "AOV",
      projectState: "Project State", currentPhase: "Current Phase",
      currentOwnerTeam: "Current Team", assignedOwnerName: "Assigned Owner",
      currentResponsibility: "Responsibility", goLivePercent: "Go Live %",
      pendingAcceptance: "Pending Acceptance",
      kickOffDate: "Kick-Off Date", expectedGoLiveDate: "Expected Go-Live", goLiveDate: "Go-Live Date",
      salesSpoc: "Sales SPOC", integrationType: "Integration Type", pgOnboarding: "PG Onboarding",
      brandUrl: "Brand URL", jiraLink: "JIRA Link", brdLink: "BRD Link",
      mintNotes: "MINT Notes", projectNotes: "Project Notes", currentPhaseComment: "Phase Comment",
    };

    // Map DB column names to project fields
    const dbToField: Record<string, string> = {
      merchantName: "merchant_name", mid: "mid", platform: "platform", category: "category",
      arr: "arr", txnsPerDay: "txns_per_day", aov: "aov",
      projectState: "project_state", currentPhase: "current_phase",
      currentOwnerTeam: "current_owner_team",
      currentResponsibility: "current_responsibility", goLivePercent: "go_live_percent",
      pendingAcceptance: "pending_acceptance",
      kickOffDate: "kick_off_date", expectedGoLiveDate: "expected_go_live_date", goLiveDate: "go_live_date",
      salesSpoc: "sales_spoc", integrationType: "integration_type", pgOnboarding: "pg_onboarding",
      brandUrl: "brand_url", jiraLink: "jira_link", brdLink: "brd_link",
      mintNotes: "mint_notes", projectNotes: "project_notes", currentPhaseComment: "current_phase_comment",
    };

    function getCellValue(project: any, key: string): string {
      const dbKey = dbToField[key];
      if (!dbKey) return "";
      const val = project[dbKey];
      if (val === null || val === undefined) return "";
      if (key === "pendingAcceptance") return val ? "Yes" : "No";
      if (key === "goLivePercent") return `${val}%`;
      return String(val);
    }

    // Build HTML table
    const headerRow = columns.map((c: string) => 
      `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;background:#f1f5f9;font-size:12px;color:#475569;">${columnLabels[c] || c}</th>`
    ).join("");

    const bodyRows = (projects || []).map((p: any, i: number) => {
      const bgColor = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = columns.map((c: string) => 
        `<td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;background:${bgColor};">${getCellValue(p, c)}</td>`
      ).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:20px;border-radius:12px 12px 0 0;color:white;">
          <h1 style="margin:0;font-size:18px;">📊 ${report.name}</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Scheduled Report — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div style="background:#ffffff;padding:0;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <div style="padding:12px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">Total: ${(projects || []).length} projects · Generated at ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    `;

    // Send emails via Resend
    const errors: string[] = [];
    let successCount = 0;

    for (const email of recipients) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Project Tracker <onboarding@resend.dev>",
            to: [email],
            subject: `📊 Report: ${report.name} — ${new Date().toLocaleDateString()}`,
            html: htmlContent,
          }),
        });

        const result = await emailRes.json();
        if (!emailRes.ok) {
          errors.push(`${email}: ${result.message || "Failed"}`);
          console.error(`Failed to send to ${email}:`, result);
        } else {
          successCount++;
          console.log(`Email sent to ${email}:`, result.id);
        }
      } catch (e) {
        errors.push(`${email}: ${e.message}`);
      }
    }

    // Update execution record
    const finalStatus = errors.length === 0 ? "success" : successCount > 0 ? "partial" : "failed";
    if (execution) {
      await supabase
        .from("report_executions")
        .update({
          status: finalStatus,
          error_message: errors.length > 0 ? errors.join("; ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        sent: successCount,
        failed: errors.length,
        errors,
        execution_id: execution?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-scheduled-report error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
