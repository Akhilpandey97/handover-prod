// AI Project Insights Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project, projects, type } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

    // Batch mode: generate next actions for multiple projects
    if (type === "next_actions" && projects) {
      const projectsSummary = projects.map((p: any) => {
        const completed = p.checklist?.filter((c: any) => c.completed).length || 0;
        const total = p.checklist?.length || 0;
        const pending = p.checklist?.filter((c: any) => !c.completed).map((c: any) => c.title).slice(0, 3).join(", ") || "None";
        return `- ${p.merchantName} (${p.currentPhase}/${p.projectState || "not_started"}): ${completed}/${total} done. Next: ${pending}`;
      }).join("\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `You are a project management AI. For each project listed, provide exactly ONE critical next action and flag any blockers. Format as JSON array: [{"project":"name","action":"next action","priority":"high|medium|low","alert":"optional critical alert or empty string"}]. Only output the JSON array, nothing else.` },
            { role: "user", content: projectsSummary },
          ],
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      // Extract JSON from content
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: projectSummary },
        ],
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
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
