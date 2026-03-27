import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { processWorkflowQueue } from "../_shared/workflow-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const WORKFLOW_TRIGGER_TYPES = [
  "project_created",
  "field_match",
  "field_changed",
  "field_changed_to",
  "owner_unassigned",
  "project_blocked",
  "checklist_item_completed",
  "checklist_item_uncompleted",
  "checklist_responsibility_changed",
  "checklist_comment_added",
  "checklist_any_completed",
  "checklist_all_completed",
  "checklist_completion_threshold",
] as const;
const WORKFLOW_ACTION_TYPES = [
  "assign_owner",
  "update_field",
  "notify_email",
  "log_activity",
  "append_project_note",
  "create_comment",
  "create_checklist_item",
] as const;

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
      description: "Create an automated workflow rule using only supported trigger/action combinations. Supports project triggers like project_created, field_changed_to, owner_unassigned, project_blocked and checklist triggers like checklist_item_completed, checklist_comment_added, checklist_all_completed. Supports actions like assign_owner, update_field, notify_email, log_activity, append_project_note, create_comment, and create_checklist_item.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workflow name" },
          description: { type: "string", description: "What this workflow does" },
          trigger_entity: { type: "string", enum: ["project", "checklist_item", "checklist_comment"], description: "Which entity this workflow listens to" },
          trigger_type: { type: "string", enum: [...WORKFLOW_TRIGGER_TYPES], description: "What event should trigger the workflow" },
          trigger_field: { type: "string", description: "The field to watch for field-based triggers. Use project columns or checklist item columns where relevant." },
          trigger_value: { type: "string", description: "The value or threshold used by triggers like field_match, field_changed_to, or checklist_completion_threshold." },
          action_type: { type: "string", enum: [...WORKFLOW_ACTION_TYPES], description: "What action to take" },
          action_config: {
            type: "object",
            description: "Configuration for the action. Examples: {owner_id:'...', owner_name:'...'} or {owner_email:'person@example.com'} for assign_owner; {field:'project_state', value:'blocked'} for update_field; {email:'ops@example.com', subject:'...', message:'...'} for notify_email; {title:'Review launch readiness', phase:'integration', owner_team:'integration'} for create_checklist_item",
          },
          is_active: { type: "boolean", description: "Whether the workflow should start active. Defaults to true." },
        },
        required: ["name", "trigger_type", "action_type", "action_config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sample_workflows",
      description: "Create a safe set of sample workflows that demonstrate supported workflow types and actions for the current tenant.",
      parameters: {
        type: "object",
        properties: {
          notification_email: { type: "string", description: "Email address to use for sample notification workflows. Defaults to the current user's email if available." },
          activate: { type: "boolean", description: "Whether the sample workflows should be active immediately. Defaults to true." },
        },
        required: [],
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

const findEmailInText = (text?: string | null) => {
  if (!text) return null;
  const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return match?.[0] || null;
};

const resolveWorkflowOwner = async (
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  actionConfig: Record<string, unknown>,
  fallbackText?: string | null,
) => {
  if (actionConfig.owner_id) {
    return {
      owner_id: String(actionConfig.owner_id),
      owner_name: actionConfig.owner_name ? String(actionConfig.owner_name) : null,
    };
  }

  const ownerEmail =
    (actionConfig.owner_email ? String(actionConfig.owner_email) : null)
    || (actionConfig.email ? String(actionConfig.email) : null)
    || findEmailInText(fallbackText);
  const ownerName = actionConfig.owner_name ? String(actionConfig.owner_name) : null;

  let query = supabase
    .from("profiles")
    .select("id, name, email")
    .eq("tenant_id", tenantId)
    .limit(1);

  if (ownerEmail) {
    query = query.eq("email", ownerEmail);
  } else if (ownerName) {
    query = query.ilike("name", ownerName);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    owner_id: data.id,
    owner_name: data.name || ownerName || ownerEmail,
  };
};

const normalizeWorkflowArgs = async (
  raw: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
) => {
  const triggerType = String(raw.trigger_type || "").trim();
  const actionType = String(raw.action_type || "").trim();
  const triggerField = raw.trigger_field ? String(raw.trigger_field).trim() : null;
  let triggerEntity = raw.trigger_entity ? String(raw.trigger_entity).trim() : "project";
  let triggerValue = raw.trigger_value !== undefined && raw.trigger_value !== null ? String(raw.trigger_value) : null;
  const actionConfig = (raw.action_config || {}) as Record<string, unknown>;

  if (!WORKFLOW_TRIGGER_TYPES.includes(triggerType as typeof WORKFLOW_TRIGGER_TYPES[number])) {
    throw new Error(`Unsupported trigger_type: ${triggerType}`);
  }

  if (!WORKFLOW_ACTION_TYPES.includes(actionType as typeof WORKFLOW_ACTION_TYPES[number])) {
    throw new Error(`Unsupported action_type: ${actionType}`);
  }

  if (triggerType.startsWith("checklist_") && triggerType !== "checklist_comment_added") {
    triggerEntity = "checklist_item";
  }
  if (triggerType === "checklist_comment_added") {
    triggerEntity = "checklist_comment";
  }

  if (["field_match", "field_changed", "field_changed_to"].includes(triggerType) && !triggerField) {
    throw new Error(`trigger_field is required for ${triggerType}`);
  }

  if (["field_match", "field_changed_to"].includes(triggerType) && !triggerValue) {
    throw new Error(`trigger_value is required for ${triggerType}`);
  }

  if (triggerType === "checklist_completion_threshold") {
    triggerValue = triggerValue || String(actionConfig.threshold || actionConfig.percentage || "");
    if (!triggerValue) throw new Error("checklist_completion_threshold requires trigger_value or action_config.threshold");
  }

  if (actionType === "notify_email" && !actionConfig.email) {
    throw new Error("notify_email requires action_config.email");
  }

  if (actionType === "update_field" && (!actionConfig.field || actionConfig.value === undefined)) {
    throw new Error("update_field requires action_config.field and action_config.value");
  }

  if (actionType === "assign_owner") {
    const resolvedOwner = await resolveWorkflowOwner(
      supabase,
      tenantId,
      actionConfig,
      [raw.description, JSON.stringify(actionConfig)].filter(Boolean).join(" "),
    );

    if (!resolvedOwner?.owner_id) {
      throw new Error("assign_owner requires action_config.owner_id or a resolvable owner email/name");
    }

    actionConfig.owner_id = resolvedOwner.owner_id;
    if (!actionConfig.owner_name && resolvedOwner.owner_name) {
      actionConfig.owner_name = resolvedOwner.owner_name;
    }
  }

  return {
    name: String(raw.name || "").trim(),
    description: raw.description ? String(raw.description) : null,
    trigger_entity: triggerEntity,
    trigger_type: triggerType,
    trigger_field: ["field_match", "field_changed", "field_changed_to"].includes(triggerType) ? triggerField : "*",
    trigger_value: triggerValue,
    action_type: actionType,
    action_config: actionConfig,
    is_active: raw.is_active === undefined ? true : Boolean(raw.is_active),
  };
};

const getSampleWorkflowDefinitions = (email: string | null, activate: boolean) => {
  const notificationEmail = email || "ops@example.com";
  return [
    {
      name: "Sample: Notify On Project Creation",
      description: "Send an email whenever a new project is created.",
      trigger_type: "project_created",
      trigger_entity: "project",
      action_type: "notify_email",
      action_config: {
        email: notificationEmail,
        subject: "New project created: {{project_name}}",
        message: "A new project named {{project_name}} was created in phase {{current_phase}} with platform {{platform}}.",
      },
      is_active: activate,
    },
    {
      name: "Sample: Log Unassigned Projects",
      description: "Log whenever a project has no assigned owner.",
      trigger_type: "owner_unassigned",
      trigger_entity: "project",
      action_type: "log_activity",
      action_config: {
        message: "Workflow noticed that {{project_name}} has no assigned owner.",
      },
      is_active: activate,
    },
    {
      name: "Sample: Escalate Blocked Projects",
      description: "Append a note whenever a project becomes blocked.",
      trigger_type: "project_blocked",
      trigger_entity: "project",
      action_type: "append_project_note",
      action_config: {
        note: "Workflow alert: {{project_name}} entered blocked state.",
      },
      is_active: activate,
    },
    {
      name: "Sample: Checklist Completion Audit",
      description: "Log when a checklist item is completed.",
      trigger_type: "checklist_item_completed",
      trigger_entity: "checklist_item",
      action_type: "log_activity",
      action_config: {
        message: "Checklist item {{checklist_title}} was completed for {{project_name}}.",
      },
      is_active: activate,
    },
    {
      name: "Sample: Follow-up Checklist Task",
      description: "Create a follow-up checklist item when a project enters integration.",
      trigger_type: "field_changed_to",
      trigger_entity: "project",
      trigger_field: "current_phase",
      trigger_value: "integration",
      action_type: "create_checklist_item",
      action_config: {
        title: "Review integration readiness for {{project_name}}",
        phase: "integration",
        owner_team: "integration",
      },
      is_active: activate,
    },
    {
      name: "Sample: Comment Notification",
      description: "Send an email when a checklist comment is added.",
      trigger_type: "checklist_comment_added",
      trigger_entity: "checklist_comment",
      action_type: "notify_email",
      action_config: {
        email: notificationEmail,
        subject: "Checklist comment added on {{project_name}}",
        message: "{{comment_author}} added a checklist comment: {{checklist_comment}}",
      },
      is_active: activate,
    },
    {
      name: "Sample: All Checklist Items Complete",
      description: "Move the project to in_progress once all checklist items are complete.",
      trigger_type: "checklist_all_completed",
      trigger_entity: "checklist_item",
      action_type: "update_field",
      action_config: {
        target_entity: "project",
        field: "project_state",
        value: "in_progress",
      },
      is_active: activate,
    },
  ];
};

async function executeToolCall(
  functionName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  tenantId: string | null,
  userId: string | null,
  userEmail: string | null,
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
    await processWorkflowQueue(supabase, tenantId, 50);
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
    await processWorkflowQueue(supabase, tenantId, 50);
    return JSON.stringify({ success: true, message: `Updated ${data?.merchant_name || "the project"}: ${Object.keys(updates).join(", ")}` });
  }

  if (functionName === "create_workflow") {
    const normalized = await normalizeWorkflowArgs(args, supabase, tenantId);
    const { data, error } = await supabase.from("chat_workflows").insert({
      tenant_id: tenantId,
      created_by: userId,
      ...normalized,
    }).select().single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    await logActivity(supabase, tenantId, userId, "create_workflow", "workflow", data.id, normalized.name, {
      trigger_type: normalized.trigger_type,
      trigger_entity: normalized.trigger_entity,
      action_type: normalized.action_type,
    });
    return JSON.stringify({ success: true, message: `Created workflow "${normalized.name}" (ID: ${data.id})` });
  }

  if (functionName === "create_sample_workflows") {
    const activate = args.activate === undefined ? true : Boolean(args.activate);
    const email = args.notification_email ? String(args.notification_email) : userEmail;
    const definitions = await Promise.all(
      getSampleWorkflowDefinitions(email || null, activate).map((definition) =>
        normalizeWorkflowArgs(definition, supabase, tenantId),
      ),
    );
    const { data, error } = await supabase
      .from("chat_workflows")
      .insert(definitions.map((workflow) => ({
        tenant_id: tenantId,
        created_by: userId,
        ...workflow,
      })))
      .select("id, name");

    if (error) return JSON.stringify({ success: false, error: error.message });

    await logActivity(supabase, tenantId, userId, "create_workflow", "workflow_bundle", data?.[0]?.id || "", "Sample Workflows", {
      count: data?.length || 0,
      activate,
      notification_email: email,
    });

    return JSON.stringify({
      success: true,
      message: `Created ${data?.length || 0} sample workflows.`,
      workflows: data || [],
    });
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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant_id from auth token
    let tenantId: string | null = null;
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase.from("profiles").select("tenant_id, email").eq("id", user.id).single();
        tenantId = profile?.tenant_id || null;
        userEmail = profile?.email || user.email || null;
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
- **Create a sample workflow pack** using create_sample_workflows
- **List active workflows** using list_workflows
- **Delete workflows** using delete_workflow

SUPPORTED WORKFLOW TRIGGERS:
- project_created
- field_match
- field_changed
- field_changed_to
- owner_unassigned
- project_blocked
- checklist_item_completed
- checklist_item_uncompleted
- checklist_responsibility_changed
- checklist_comment_added
- checklist_any_completed
- checklist_all_completed
- checklist_completion_threshold

SUPPORTED WORKFLOW ACTIONS:
- assign_owner
- update_field
- notify_email
- log_activity
- append_project_note
- create_comment
- create_checklist_item

Never claim a workflow was created unless it uses one of the supported trigger/action combinations above.

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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        tool_choice: "auto",
        stream: false,
        temperature: 0.2,
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

        const result = await executeToolCall(toolCall.function.name, args, supabase, tenantId, userId, userEmail);
        toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: result });
        const parsed = JSON.parse(result);
        actionsTaken.push(parsed.success ? parsed.message : `Failed: ${parsed.error}`);
      }

      const secondResponse = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages, assistantMessage, ...toolResults],
          stream: false,
          temperature: 0.2,
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
