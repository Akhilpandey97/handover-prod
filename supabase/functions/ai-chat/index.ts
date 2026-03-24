import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const tools = [
  {
    type: "function",
    function: {
      name: "assign_owner",
      description: "Assign an owner to a project. Use when the user asks to assign someone to a project.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The project UUID" },
          owner_id: { type: "string", description: "The user UUID of the new owner" },
          owner_name: { type: "string", description: "The name of the new owner" },
        },
        required: ["project_id", "owner_id", "owner_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Update project fields like state, phase, expected_go_live_date, project_notes, current_phase_comment, arr, platform, category, sales_spoc. Use when the user asks to update/change a project field.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The project UUID" },
          updates: {
            type: "object",
            description: "Key-value pairs of fields to update",
            properties: {
              project_state: { type: "string", enum: ["not_started", "on_hold", "in_progress", "live", "blocked"] },
              current_phase: { type: "string", enum: ["mint", "integration", "ms", "completed"] },
              expected_go_live_date: { type: "string", description: "ISO date string" },
              project_notes: { type: "string" },
              current_phase_comment: { type: "string" },
              arr: { type: "number" },
              platform: { type: "string" },
              category: { type: "string" },
              sales_spoc: { type: "string" },
            },
          },
        },
        required: ["project_id", "updates"],
      },
    },
  },
];

async function executeToolCall(
  functionName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  if (functionName === "assign_owner") {
    const { project_id, owner_id, owner_name } = args as { project_id: string; owner_id: string; owner_name: string };
    const { error } = await supabase
      .from("projects")
      .update({ assigned_owner: owner_id })
      .eq("id", project_id);
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, message: `Assigned ${owner_name} as owner.` });
  }

  if (functionName === "update_project") {
    const { project_id, updates } = args as { project_id: string; updates: Record<string, unknown> };
    const dbUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      dbUpdates[key] = value;
    }
    const { error } = await supabase.from("projects").update(dbUpdates).eq("id", project_id);
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, message: `Updated project fields: ${Object.keys(updates).join(", ")}` });
  }

  return JSON.stringify({ success: false, error: "Unknown function" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const { messages, projectContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const model = DEFAULT_MODEL;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Create supabase client for tool execution using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const systemPrompt = `You are an AI assistant for a project management dashboard. You help users understand their projects, provide insights, and answer questions about project status, timelines, and team workloads.

You can also take ACTIONS when users ask you to:
- Assign an owner to a project using the assign_owner tool
- Update project fields (state, phase, dates, notes, ARR, etc.) using the update_project tool

When the user asks to assign or update, use the appropriate tool. Match project names to IDs from the context.

${projectContext ? `Here is the current project data context:\n${projectContext}\n\n` : ""}

Guidelines:
- Be concise and actionable in your responses
- Use bullet points for lists
- Highlight risks and blockers proactively
- Reference specific project names and data when available
- If asked about something not in the data, say so clearly
- When performing actions, confirm what you did`;

    // First call - may include tool calls
    const firstResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI API error:", firstResponse.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstData = await firstResponse.json();
    const assistantMessage = firstData.choices?.[0]?.message;

    // Check if there are tool calls
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      const actionsTaken: string[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeToolCall(toolCall.function.name, args, supabase);
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
        const parsed = JSON.parse(result);
        actionsTaken.push(parsed.success ? parsed.message : `Failed: ${parsed.error}`);
      }

      // Second call to get natural language response after tool execution
      const secondResponse = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
          stream: false,
        }),
      });

      if (!secondResponse.ok) {
        // Return action results directly if second call fails
        return new Response(JSON.stringify({
          choices: [{ message: { role: "assistant", content: `✅ Actions completed:\n${actionsTaken.map(a => `- ${a}`).join("\n")}` } }],
          actions: actionsTaken,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const secondData = await secondResponse.json();
      secondData.actions = actionsTaken;
      return new Response(JSON.stringify(secondData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls - return regular response
    return new Response(JSON.stringify(firstData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
