import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Parse INR currency strings like "INR 1,571,461.88" to number
function parseINR(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

// Parse HTML table from email body into key-value pairs
function parseEmailTable(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Match table rows with two cells
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    let key = match[1].replace(/<[^>]*>/g, "").replace(/\s*:\s*$/, "").trim();
    let value = match[2].replace(/<[^>]*>/g, "").trim();
    if (key) {
      fields[key] = value;
    }
  }
  return fields;
}

// Extract brand name from subject like "New Brand On Board - Sirphire- Storefront"
function extractBrandFromSubject(subject: string): string {
  const match = subject.match(/New Brand On Board\s*[-–—]\s*(.*)/i);
  return match ? match[1].trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Gmail API credentials not configured. Please add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request body for tenant context
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch email settings from app_settings for this tenant
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["email_monitor_address", "email_subject_keywords"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const monitorEmail = settingsMap.email_monitor_address || "cwupdates@gokwik.co";
    const subjectKeywords = (settingsMap.email_subject_keywords || "New Brand On Board")
      .split(",")
      .map((k: string) => k.trim().toLowerCase());

    // Step 1: Get access token using refresh token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to refresh Gmail access token", details: tokenData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;

    // Debug: check which Gmail account this token belongs to
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = await profileRes.json();
    console.log("Gmail profile:", JSON.stringify(profileData));

    // Step 2: Search for matching emails (last 30 days, from specific sender, matching subject)
    const query = `from:${monitorEmail} subject:(${subjectKeywords.join(" OR ")}) newer_than:30d`;
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;

    console.log("Gmail search query:", query);
    console.log("Gmail search URL:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    console.log("Gmail search response:", JSON.stringify(searchData).substring(0, 500));

    // Check for API errors (e.g. Gmail API not enabled)
    if (searchData.error) {
      const errMsg = searchData.error.message || "Unknown Gmail API error";
      console.error("Gmail API error:", errMsg);
      return new Response(
        JSON.stringify({ error: `Gmail API error: ${errMsg}`, details: searchData.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = searchData.messages || [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No matching emails found", query }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Check which messages are already processed
    const messageIds = messages.map((m: any) => m.id);
    const { data: existingEmails } = await supabase
      .from("parsed_emails")
      .select("gmail_message_id")
      .eq("tenant_id", tenantId)
      .in("gmail_message_id", messageIds);

    const existingIds = new Set((existingEmails || []).map((e: any) => e.gmail_message_id));
    const newMessages = messages.filter((m: any) => !existingIds.has(m.id));

    if (newMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "All matching emails already processed", total: messages.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch and parse each new message
    const results: any[] = [];

    for (const msg of newMessages) {
      try {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const msgRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const msgData = await msgRes.json();

        // Extract subject and sender from headers
        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
        const sender = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
        const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

        // Verify subject matches keywords
        const subjectLower = subject.toLowerCase();
        const matches = subjectKeywords.some((kw: string) => subjectLower.includes(kw));
        if (!matches) continue;

        // Extract HTML body
        let htmlBody = "";
        function extractHtml(part: any) {
          if (part.mimeType === "text/html" && part.body?.data) {
            htmlBody = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          }
          if (part.parts) {
            for (const p of part.parts) extractHtml(p);
          }
        }
        extractHtml(msgData.payload);

        // Parse the HTML table
        const fields = parseEmailTable(htmlBody);
        const brandName = fields["Brand Name"] || extractBrandFromSubject(subject);
        const brandUrl = fields["URL_1"] || "";
        const platform = fields["Platform"] || "";
        const subPlatform = fields["Sub Platform"] || "";
        const arrValue = parseINR(fields["Expected ARR"] || "");
        const category = fields["Merchant Category"] || "";
        const txnsPerDay = parseInt(fields["Expected Transactions/day"] || "0") || 0;
        const aov = parseINR(fields["AOV (Average Order Value )"] || fields["AOV (Average Order Value)"] || "");
        const merchantSize = fields["Merchant Size"] || "";
        const city = fields["City"] || "";
        const notes = fields["Notes"] || "";

        // Insert parsed email
        const { data: inserted, error: insertError } = await supabase
          .from("parsed_emails")
          .insert({
            tenant_id: tenantId,
            gmail_message_id: msg.id,
            subject,
            sender,
            received_at: receivedAt,
            brand_name: brandName,
            brand_url: brandUrl,
            platform,
            sub_platform: subPlatform,
            arr: arrValue,
            category,
            txns_per_day: txnsPerDay,
            aov,
            merchant_size: merchantSize,
            city,
            sales_notes: notes,
            parsed_fields: fields,
            raw_html: htmlBody.substring(0, 50000), // Limit storage
            status: "new",
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting email ${msg.id}:`, insertError);
        } else {
          results.push(inserted);

          // Auto-create project from the parsed email
          try {
            const autoProject = {
              tenant_id: tenantId,
              merchant_name: brandName || `Email-${msg.id.substring(0, 8)}`,
              mid: `AUTO-${msg.id.substring(0, 8)}`,
              current_phase: "mint",
              current_owner_team: "mint",
              arr: arrValue || 0,
              txns_per_day: txnsPerDay || 0,
              aov: aov || 0,
              platform: platform || "Custom",
              category: category || "",
              brand_url: brandUrl || "",
              integration_type: "Standard",
              sales_spoc: "",
              current_responsibility: "neutral",
              pending_acceptance: false,
              project_state: "not_started",
              go_live_percent: 0,
              kick_off_date: new Date().toISOString().split("T")[0],
              current_phase_comment: "Auto-created from email — needs manager review",
              project_notes: notes || "",
              pg_onboarding: "",
            };

            const { data: createdProject, error: projectError } = await supabase
              .from("projects")
              .insert(autoProject)
              .select("id")
              .single();

            if (projectError) {
              console.error(`Error auto-creating project for ${msg.id}:`, projectError);
            } else {
              // Link email to project
              await supabase
                .from("parsed_emails")
                .update({ status: "project_created", project_id: createdProject.id })
                .eq("id", inserted.id);

              // Create default checklist items for the project
              const defaultChecklist = [
                { title: "Brand Kick-Off Call", phase: "mint", owner_team: "mint" },
                { title: "BRD Sign-Off", phase: "mint", owner_team: "mint" },
                { title: "JIRA Ticket Created", phase: "mint", owner_team: "mint" },
                { title: "API Keys Shared", phase: "integration", owner_team: "integration" },
                { title: "Integration Development", phase: "integration", owner_team: "integration" },
                { title: "UAT Testing", phase: "integration", owner_team: "integration" },
                { title: "Go-Live Approval", phase: "ms", owner_team: "ms" },
              ];

              const checklistItems = defaultChecklist.map((item, idx) => ({
                project_id: createdProject.id,
                tenant_id: tenantId,
                title: item.title,
                phase: item.phase,
                owner_team: item.owner_team,
                sort_order: idx,
                completed: false,
                current_responsibility: "neutral",
              }));

              await supabase.from("checklist_items").insert(checklistItems);

              console.log(`Auto-created project ${createdProject.id} for email ${msg.id}`);
            }
          } catch (autoErr) {
            console.error(`Error in auto-project-creation for ${msg.id}:`, autoErr);
          }
        }
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} new email(s)`,
        total_found: messages.length,
        new_processed: results.length,
        emails: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in poll-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
