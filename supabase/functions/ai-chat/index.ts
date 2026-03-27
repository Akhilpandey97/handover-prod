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
  {
    type: "function",
    function: {
      name: "create_workflow",
      description: "Create an automated workflow rule. Examples: auto-assign owner when a field matches a condition, change state at a scheduled time, notify when a project is blocked. trigger_field can be: project_state, current_phase, platform, category, arr, current_responsibility, assigned_owner, expected_go_live_date. action_type can be: assign_owner, update_field, notify.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workflow name" },
          description: { type: "string", description: "What this workflow does" },
          trigger_field: { type: "string", description: "The project field that triggers this workflow" },
          trigger_value: { type: "string", description: "The value that triggers the action" },
          action_type: { type: "string", enum: ["assign_owner", "update_field", "notify"], description: "What action to take" },
          action_config: {
            type: "object",
            description: "Configuration for the action (e.g. {field: 'project_state', value: 'in_progress'} or {owner_id: '...', owner_name: '...'})",
          },
        },
        required: ["name", "trigger_field", "action_type", "action_config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "List all active workflow rules. Use when user asks to see current workflows or automations.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_workflow",
      description: "Delete a workflow rule by ID. Use when the user asks to remove a workflow.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "The workflow UUID to delete" },
        },
        required: ["workflow_id"],
      },
    },
  },
];

async function logActivity(
  supabase: ReturnType<typeof createClient>,
  tenantId: string | null,
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: Record<string, unknown>,
) {
  await supabase.from("activity_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    entity_name: entityName || null,
    details: details || {},
    user_name: "AI Assistant",
  });
}

async function executeToolCall(
  functionName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  tenantId: string | null,
  userId: string | null,
): Promise<string> {
  if (!tenantId) {
    return JSON.stringify({ success: false, error: "Missing tenant context for this request." });
  }

  if (functionName === "assign_owner") {
    const { project_id, owner_id, owner_name } = args as { project_id: string; owner_id: string; owner_name: string };
    const { data, error } = await supabase
      .from("projects")
      .update({ assigned_owner: owner_id })
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select("id, merchant_name")
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    await logActivity(supabase, tenantId, userId, "assign_owner", "project", project_id, data?.merchant_name, { owner_id, owner_name });
    return JSON.stringify({ success: true, message: `Assigned ${owner_name} as owner for ${data?.merchant_name || "the project"}.` });
  }

  if (functionName === "update_project") {
    const { project_id, updates } = args as { project_id: string; updates: Record<string, unknown> };
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select("id, merchant_name")
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    await logActivity(supabase, tenantId, userId, "update_project", "project", project_id, data?.merchant_name, updates);
    return JSON.stringify({ success: true, message: `Updated ${data?.merchant_name || "the project"}: ${Object.keys(updates).join(", ")}` });
  }

  if (functionName === "create_workflow") {
    const { name, description, trigger_field, trigger_value, action_type, action_config } = args as any;
    const { data, error } = await supabase.from("chat_workflows").insert({
      tenant_id: tenantId,
      created_by: userId,
      name,
      description: description || null,
      trigger_field,
      trigger_value: trigger_value || null,
      action_type,
      action_config,
    }).select().single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    await logActivity(supabase, tenantId, userId, "create_workflow", "workflow", data.id, name, { trigger_field, trigger_value, action_type });
    return JSON.stringify({ success: true, message: `Created workflow "${name}" (ID: ${data.id})` });
  }

  if (functionName === "list_workflows") {
    const { data, error } = await supabase
      .from("chat_workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) return JSON.stringify({ success: false, error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ success: true, workflows: [], message: "No active workflows found." });
    return JSON.stringify({ success: true, workflows: data });
  }

  if (functionName === "delete_workflow") {
    const { workflow_id } = args as { workflow_id: string };
    const { data, error } = await supabase
      .from("chat_workflows")
      .delete()
      .eq("id", workflow_id)
      .eq("tenant_id", tenantId)
      .select("id, name")
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    await logActivity(supabase, tenantId, userId, "delete_workflow", "workflow", workflow_id, data?.name);
    return JSON.stringify({ success: true, message: `Deleted workflow ${data?.name || workflow_id}` });
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant_id from auth token
    let tenantId: string | null = null;
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
        tenantId = profile?.tenant_id || null;
      }
    }

    if (!userId || !tenantId) {
      return new Response(JSON.stringify({ error: "Unauthorized or tenant context missing." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an AI assistant for a project management dashboard. You help users understand their projects, provide insights, and answer questions about project status, timelines, and team workloads.

You can take ACTIONS:
- **Assign owner** to a project using assign_owner
- **Update project fields** (state, phase, dates, notes, ARR, etc.) using update_project
- **Create workflow rules** for automation using create_workflow
- **List active workflows** using list_workflows
- **Delete workflows** using delete_workflow

WORKFLOW EXAMPLES you can suggest:
- Auto-assign owner when a project enters a specific phase
- Change project state when platform or category matches a value
- Log a notification when a project becomes blocked
- Auto-assign based on platform or category
- Set responsibility when phase changes

When the user asks to assign or update, use the appropriate tool. Match project names to IDs from the context.

${projectContext ? `Current project data:\n${projectContext}\n\n` : ""}

Guidelines:
- Be concise and actionable
- Use bullet points for lists
- Highlight risks and blockers proactively
- Reference specific project names and data when available
- If asked about something not in the data, say so clearly
- When performing actions, confirm what you did
- When asked about workflows, suggest relevant automations`;

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI API error:", firstResponse.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstData = await firstResponse.json();
    const assistantMessage = firstData.choices?.[0]?.message;

    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      const actionsTaken: string[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        const result = await executeToolCall(toolCall.function.name, args, supabase, tenantId, userId);
        toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: result });
        const parsed = JSON.parse(result);
        actionsTaken.push(parsed.success ? parsed.message : `Failed: ${parsed.error}`);
      }

      const secondResponse = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages, assistantMessage, ...toolResults],
          stream: false,
        }),
      });

      if (!secondResponse.ok) {
        return new Response(JSON.stringify({
          choices: [{ message: { role: "assistant", content: `✅ Actions completed:\n${actionsTaken.map(a => `- ${a}`).join("\n")}` } }],
          actions: actionsTaken,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const secondData = await secondResponse.json();
      secondData.actions = actionsTaken;
      return new Response(JSON.stringify(secondData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(firstData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
