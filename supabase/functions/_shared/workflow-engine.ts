import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type AdminClient = ReturnType<typeof createClient>;

type WorkflowRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  trigger_entity: string;
  trigger_type: string;
  trigger_field: string | null;
  trigger_value: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
};

type QueueRow = {
  id: string;
  tenant_id: string | null;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  event_type: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const WORKFLOW_USER = "AI Assistant";

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return String(value);
};

const interpolate = (template: string, values: Record<string, string | null | undefined>) => {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
};

const getRecordValue = (record: Record<string, unknown> | null | undefined, field: string | null | undefined) => {
  if (!record || !field || field === "*") return null;
  return record[field];
};

const getChanged = (event: QueueRow, field: string) => {
  return toText(getRecordValue(event.old_data, field)) !== toText(getRecordValue(event.new_data, field));
};

const inferChecklistEventType = (event: QueueRow) => {
  if (event.entity_type !== "checklist_item" || !event.new_data) return null;

  if (event.event_type === "created") return "created";

  const oldCompleted = Boolean(event.old_data?.completed);
  const newCompleted = Boolean(event.new_data?.completed);
  if (oldCompleted !== newCompleted) return newCompleted ? "completed" : "uncompleted";

  const oldResponsibility = toText(event.old_data?.current_responsibility);
  const newResponsibility = toText(event.new_data?.current_responsibility);
  if (oldResponsibility !== newResponsibility) return "responsibility_changed";

  return "updated";
};

const buildTemplateValues = async (supabase: AdminClient, event: QueueRow) => {
  const values: Record<string, string | null> = {
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    event_type: event.event_type,
  };

  if (event.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, merchant_name, project_state, current_phase, platform, category, assigned_owner, expected_go_live_date")
      .eq("id", event.project_id)
      .maybeSingle();

    if (project) {
      values.project_id = project.id;
      values.project_name = project.merchant_name;
      values.project_state = project.project_state;
      values.current_phase = project.current_phase;
      values.platform = project.platform;
      values.category = project.category;
      values.assigned_owner = project.assigned_owner;
      values.expected_go_live_date = project.expected_go_live_date;
    }
  }

  if (event.entity_type === "checklist_item" && event.new_data) {
    values.checklist_item_id = toText(event.new_data.id);
    values.checklist_title = toText(event.new_data.title);
    values.checklist_phase = toText(event.new_data.phase);
  }

  if (event.entity_type === "checklist_comment" && event.new_data) {
    values.checklist_comment = toText(event.new_data.comment);
    values.comment_author = toText(event.new_data.user_name);
    values.checklist_item_id = toText(event.new_data.checklist_item_id);
  }

  return values;
};

const insertActivity = async (
  supabase: AdminClient,
  tenantId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  entityName: string | null,
  details: Record<string, unknown>,
) => {
  await supabase.from("activity_logs").insert({
    tenant_id: tenantId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
    user_name: WORKFLOW_USER,
  });
};

const sendWorkflowEmail = async (
  workflow: WorkflowRow,
  templateValues: Record<string, string | null>,
): Promise<{ success: boolean; error?: string }> => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const email = toText(workflow.action_config.email);
  if (!email) return { success: false, error: "notify_email requires action_config.email" };

  const subjectTemplate = toText(workflow.action_config.subject) || `Workflow "${workflow.name}" triggered`;
  const bodyTemplate = toText(workflow.action_config.message)
    || workflow.description
    || `Workflow "{{workflow_name}}" was triggered for {{project_name}}.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">${interpolate(subjectTemplate, { ...templateValues, workflow_name: workflow.name })}</h2>
      <p style="white-space: pre-wrap; color: #334155; line-height: 1.6;">${interpolate(bodyTemplate, { ...templateValues, workflow_name: workflow.name })}</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Project Tracker <onboarding@resend.dev>",
      to: [email],
      subject: interpolate(subjectTemplate, { ...templateValues, workflow_name: workflow.name }),
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText || "Failed to send email" };
  }

  return { success: true };
};

const matchWorkflow = async (supabase: AdminClient, workflow: WorkflowRow, event: QueueRow) => {
  if (workflow.trigger_entity !== event.entity_type) {
    if (!(workflow.trigger_entity === "project" && event.project_id && event.entity_type !== "project")) {
      return false;
    }
  }

  const newRecord = workflow.trigger_entity === "project"
    ? (event.entity_type === "project" ? event.new_data : null)
    : event.new_data;

  switch (workflow.trigger_type) {
    case "project_created":
      return event.entity_type === "project" && event.event_type === "created";
    case "field_match":
      return toText(getRecordValue(newRecord, workflow.trigger_field)) === workflow.trigger_value;
    case "field_changed":
      return event.event_type === "updated" && !!workflow.trigger_field && getChanged(event, workflow.trigger_field);
    case "field_changed_to":
      return event.event_type === "updated"
        && !!workflow.trigger_field
        && getChanged(event, workflow.trigger_field)
        && toText(getRecordValue(newRecord, workflow.trigger_field)) === workflow.trigger_value;
    case "owner_unassigned":
      return event.entity_type === "project" && !toText(getRecordValue(event.new_data, "assigned_owner"));
    case "project_blocked":
      return event.entity_type === "project"
        && toText(getRecordValue(event.new_data, "project_state")) === "blocked"
        && (event.event_type === "created" || getChanged(event, "project_state"));
    case "checklist_item_completed":
      return inferChecklistEventType(event) === "completed";
    case "checklist_item_uncompleted":
      return inferChecklistEventType(event) === "uncompleted";
    case "checklist_responsibility_changed":
      return inferChecklistEventType(event) === "responsibility_changed";
    case "checklist_comment_added":
      return event.entity_type === "checklist_comment" && event.event_type === "created";
    case "checklist_any_completed": {
      if (event.entity_type !== "checklist_item" || !event.project_id) return false;
      const { count } = await supabase
        .from("checklist_items")
        .select("*", { count: "exact", head: true })
        .eq("project_id", event.project_id)
        .eq("completed", true);
      const currentCompleted = count || 0;
      const oldCompleted = Boolean(event.old_data?.completed);
      const newCompleted = Boolean(event.new_data?.completed);
      const previousCompleted = currentCompleted - (newCompleted ? 1 : 0) + (oldCompleted ? 1 : 0);
      return previousCompleted === 0 && currentCompleted > 0;
    }
    case "checklist_all_completed": {
      if (event.entity_type !== "checklist_item" || !event.project_id) return false;
      const { data } = await supabase
        .from("checklist_items")
        .select("completed")
        .eq("project_id", event.project_id);
      const items = data || [];
      return items.length > 0 && items.every((item) => item.completed);
    }
    case "checklist_completion_threshold": {
      if (event.entity_type !== "checklist_item" || !event.project_id) return false;
      const threshold = Number(workflow.trigger_value ?? workflow.action_config.threshold ?? workflow.action_config.percentage ?? 0);
      const { data } = await supabase
        .from("checklist_items")
        .select("completed")
        .eq("project_id", event.project_id);
      const items = data || [];
      if (items.length === 0) return false;
      const currentCompleted = items.filter((item) => item.completed).length;
      const oldCompleted = Boolean(event.old_data?.completed);
      const newCompleted = Boolean(event.new_data?.completed);
      const previousCompleted = currentCompleted - (newCompleted ? 1 : 0) + (oldCompleted ? 1 : 0);
      const currentPct = (currentCompleted / items.length) * 100;
      const previousPct = (previousCompleted / items.length) * 100;
      return previousPct < threshold && currentPct >= threshold;
    }
    default:
      return false;
  }
};

const executeWorkflowAction = async (supabase: AdminClient, workflow: WorkflowRow, event: QueueRow) => {
  const templateValues = await buildTemplateValues(supabase, event);
  const projectId = event.project_id || (event.entity_type === "project" ? event.entity_id : null);
  const projectName = templateValues.project_name || workflow.name;

  switch (workflow.action_type) {
    case "assign_owner": {
      if (!projectId) throw new Error("assign_owner requires a project context");
      const ownerId = toText(workflow.action_config.owner_id);
      if (!ownerId) throw new Error("assign_owner requires action_config.owner_id");
      const { error } = await supabase
        .from("projects")
        .update({ assigned_owner: ownerId })
        .eq("id", projectId)
        .eq("tenant_id", workflow.tenant_id);
      if (error) throw error;
      await insertActivity(supabase, workflow.tenant_id, "workflow_assign_owner", "project", projectId, projectName, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        owner_id: ownerId,
        owner_name: toText(workflow.action_config.owner_name),
      });
      return;
    }
    case "update_field": {
      const targetEntity = toText(workflow.action_config.target_entity) || "project";
      const field = toText(workflow.action_config.field);
      const value = workflow.action_config.value;
      if (!field) throw new Error("update_field requires action_config.field");
      if (targetEntity === "project") {
        if (!projectId) throw new Error("update_field on project requires a project context");
        const { error } = await supabase
          .from("projects")
          .update({ [field]: value })
          .eq("id", projectId)
          .eq("tenant_id", workflow.tenant_id);
        if (error) throw error;
        await insertActivity(supabase, workflow.tenant_id, "workflow_update_field", "project", projectId, projectName, {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          field,
          value,
        });
      } else if (targetEntity === "checklist_item") {
        const checklistItemId = toText(workflow.action_config.checklist_item_id) || (event.entity_type === "checklist_item" ? event.entity_id : null);
        if (!checklistItemId) throw new Error("update_field on checklist_item requires a checklist item context");
        const { error } = await supabase
          .from("checklist_items")
          .update({ [field]: value })
          .eq("id", checklistItemId)
          .eq("tenant_id", workflow.tenant_id);
        if (error) throw error;
        await insertActivity(supabase, workflow.tenant_id, "workflow_update_field", "checklist_item", checklistItemId, templateValues.checklist_title, {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          field,
          value,
        });
      } else {
        throw new Error(`Unsupported update_field target_entity: ${targetEntity}`);
      }
      return;
    }
    case "notify_email": {
      const result = await sendWorkflowEmail(workflow, templateValues);
      if (!result.success) throw new Error(result.error || "Failed to send workflow email");
      await insertActivity(supabase, workflow.tenant_id, "workflow_notify", event.entity_type, event.entity_id, projectName, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        email: toText(workflow.action_config.email),
      });
      return;
    }
    case "log_activity": {
      const message = interpolate(
        toText(workflow.action_config.message) || workflow.description || `Workflow "${workflow.name}" triggered.`,
        { ...templateValues, workflow_name: workflow.name },
      );
      await insertActivity(supabase, workflow.tenant_id, "workflow_log", event.entity_type, event.entity_id, projectName, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        message,
      });
      return;
    }
    case "append_project_note": {
      if (!projectId) throw new Error("append_project_note requires a project context");
      const note = interpolate(
        toText(workflow.action_config.note) || workflow.description || `Workflow "${workflow.name}" triggered.`,
        { ...templateValues, workflow_name: workflow.name },
      );
      const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("project_notes")
        .eq("id", projectId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const updatedNotes = [project?.project_notes, note].filter(Boolean).join("\n");
      const { error } = await supabase
        .from("projects")
        .update({ project_notes: updatedNotes })
        .eq("id", projectId)
        .eq("tenant_id", workflow.tenant_id);
      if (error) throw error;
      await insertActivity(supabase, workflow.tenant_id, "workflow_update_field", "project", projectId, projectName, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        field: "project_notes",
        value: note,
      });
      return;
    }
    case "create_comment": {
      const checklistItemId = toText(workflow.action_config.checklist_item_id) || (event.entity_type === "checklist_item" ? event.entity_id : toText(event.new_data?.checklist_item_id));
      if (!checklistItemId) throw new Error("create_comment requires a checklist item context");
      const comment = interpolate(
        toText(workflow.action_config.comment) || workflow.description || `Workflow "${workflow.name}" triggered.`,
        { ...templateValues, workflow_name: workflow.name },
      );
      const { error } = await supabase
        .from("checklist_comments")
        .insert({
          checklist_item_id: checklistItemId,
          comment,
          user_name: WORKFLOW_USER,
          tenant_id: workflow.tenant_id,
        });
      if (error) throw error;
      await insertActivity(supabase, workflow.tenant_id, "workflow_comment_created", "checklist_item", checklistItemId, templateValues.checklist_title, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        comment,
      });
      return;
    }
    case "create_checklist_item": {
      if (!projectId) throw new Error("create_checklist_item requires a project context");
      const title = interpolate(
        toText(workflow.action_config.title) || workflow.description || `Follow-up from ${workflow.name}`,
        { ...templateValues, workflow_name: workflow.name },
      );
      const phase = toText(workflow.action_config.phase) || "integration";
      const ownerTeam = toText(workflow.action_config.owner_team) || "integration";
      const { data: existingItems } = await supabase
        .from("checklist_items")
        .select("sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextSortOrder = ((existingItems?.[0]?.sort_order as number | undefined) ?? -1) + 1;
      const { error } = await supabase
        .from("checklist_items")
        .insert({
          project_id: projectId,
          title,
          phase,
          owner_team: ownerTeam,
          current_responsibility: "neutral",
          sort_order: nextSortOrder,
          tenant_id: workflow.tenant_id,
        });
      if (error) throw error;
      await insertActivity(supabase, workflow.tenant_id, "workflow_checklist_item_created", "project", projectId, projectName, {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        title,
        phase,
        owner_team: ownerTeam,
      });
      return;
    }
    default:
      throw new Error(`Unsupported workflow action: ${workflow.action_type}`);
  }
};

export const processWorkflowQueue = async (supabase: AdminClient, tenantId: string, limit = 50) => {
  let totalProcessedEvents = 0;
  let matchedRuns = 0;

  for (let cycle = 0; cycle < 5; cycle += 1) {
    const { data: events, error: eventsError } = await supabase
      .from("workflow_event_queue")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) break;

    const { data: workflows, error: workflowsError } = await supabase
      .from("chat_workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (workflowsError) throw workflowsError;

    for (const rawEvent of events as QueueRow[]) {
      let eventStatus = "processed";
      let eventError: string | null = null;

      for (const workflow of (workflows || []) as WorkflowRow[]) {
        const { data: existingRun } = await supabase
          .from("workflow_event_runs")
          .select("id")
          .eq("queue_event_id", rawEvent.id)
          .eq("workflow_id", workflow.id)
          .maybeSingle();

        if (existingRun) continue;

        const matched = await matchWorkflow(supabase, workflow, rawEvent);
        if (!matched) continue;

        matchedRuns += 1;

        try {
          await executeWorkflowAction(supabase, workflow, rawEvent);
          await supabase.from("workflow_event_runs").insert({
            queue_event_id: rawEvent.id,
            workflow_id: workflow.id,
            status: "success",
          });
        } catch (error) {
          eventStatus = "processed_with_errors";
          eventError = error instanceof Error ? error.message : "Unknown workflow error";
          await supabase.from("workflow_event_runs").insert({
            queue_event_id: rawEvent.id,
            workflow_id: workflow.id,
            status: "error",
            error_message: eventError,
          });
          await insertActivity(supabase, tenantId, "workflow_error", "workflow", workflow.id, workflow.name, {
            queue_event_id: rawEvent.id,
            error: eventError,
          });
        }
      }

      await supabase
        .from("workflow_event_queue")
        .update({
          status: eventStatus,
          error_message: eventError,
          processed_at: new Date().toISOString(),
        })
        .eq("id", rawEvent.id);
    }

    totalProcessedEvents += events.length;
  }

  return {
    processedEvents: totalProcessedEvents,
    matchedRuns,
  };
};
