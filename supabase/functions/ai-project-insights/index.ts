// AI Project Insights Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { project, projects, type } = body;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    // AI-powered email field mapping
    if (type === "map_email_fields") {
      const { emailFields, projectFields } = body;

      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You are a data mapping assistant. You must map email fields to project fields. Each email field has an ID (like "field_0"), a label, and a value. Each project field has a key (like "merchantName"). Return a JSON mapping where keys are the email field IDs (field_0, field_1, etc.) and values are the best matching project field keys. Use "skip" for fields with no good match. ONLY output valid JSON, nothing else.`,
            },
            {
              role: "user",
              content: `Map these email fields to the project fields below.\n\nEMAIL FIELDS:\n${emailFields}\n\nPROJECT FIELDS:\n${projectFields}\n\nReturn JSON like: {"field_0": "merchantName", "field_1": "arr", "field_2": "skip"}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "email_field_mapping",
              schema: {
                type: "object",
                additionalProperties: {
                  type: "string",
                },
              },
            },
          },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("OpenAI API error:", response.status, errText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      let result = {};
      const content = data.choices?.[0]?.message?.content || "{}";
      try {
        result = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      }

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode: generate next actions for multiple projects
    if (type === "next_actions" && projects) {
      const projectsSummary = projects.map((p: any) => {
        const completed = p.checklist?.filter((c: any) => c.completed).length || 0;
        const total = p.checklist?.length || 0;
        const pending = p.checklist?.filter((c: any) => !c.completed).map((c: any) => c.title).slice(0, 3).join(", ") || "None";
        return `- ${p.merchantName} (${p.currentPhase}/${p.projectState || "not_started"}): ${completed}/${total} done. Next: ${pending}`;
      }).join("\n");

      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `You are a project management AI. For each project listed, provide exactly ONE critical next action and flag any blockers. Format as JSON array: [{"project":"name","action":"next action","priority":"high|medium|low","alert":"optional critical alert or empty string"}]. Only output the JSON array, nothing else.` },
            { role: "user", content: projectsSummary },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenAI API error:", response.status, errText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt: string;
    if (type === "insights") {
      systemPrompt = `You are a project management AI analyst. Given a project's data, provide 3-4 concise, actionable insights about the project's health, risks, and recommendations. Be specific and data-driven. Keep each insight to 1-2 sentences. Format as bullet points. Note: "Kick Off Date" means the project start date.`;
    } else {
      systemPrompt = `You are a project management AI summarizer. Given a project's checklist and status data, provide a brief task summary: what's done, what's pending, blockers, and next priority action. Keep it concise (4-5 bullet points max). Note: "Kick Off Date" means the project start date.`;
    }

    const projectSummary = `
Project: ${project.merchantName} (MID: ${project.mid})
Phase: ${project.currentPhase}
State: ${project.projectState || "not_started"}
ARR: ${project.arr} Cr
Platform: ${project.platform}
Start Date (Kick Off): ${project.dates?.kickOffDate || "N/A"}
Go Live: ${project.dates?.goLiveDate || project.dates?.expectedGoLiveDate || "Not set"}
Owner Team: ${project.currentOwnerTeam}
Pending With: ${project.currentResponsibility}
Assigned Owner: ${project.assignedOwnerName || "Unassigned"}
Checklist: ${project.checklist?.filter((c: any) => c.completed).length}/${project.checklist?.length || 0} completed
Pending Items: ${project.checklist?.filter((c: any) => !c.completed).map((c: any) => c.title).join(", ") || "None"}
Transfer History: ${project.transferHistory?.length || 0} transfers
`;

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: projectSummary },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Unable to generate insights.";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
