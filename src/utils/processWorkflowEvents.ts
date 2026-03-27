import { supabase } from "@/integrations/supabase/client";

type WorkflowProcessingResult = {
  success: boolean;
  processedEvents?: number;
  matchedRuns?: number;
  error?: string;
};

type WorkflowProcessingLogContext = {
  entityType?: string;
  entityId?: string | null;
  entityName?: string | null;
  source?: string;
  details?: Record<string, unknown>;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const logWorkflowProcessingFailure = async (
  errorMessage: string,
  context?: WorkflowProcessingLogContext,
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) return;

    await supabase.from("activity_logs").insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      user_name: profile.name || user.email || "System",
      action: "workflow_error",
      entity_type: context?.entityType || "workflow",
      entity_id: context?.entityId || null,
      entity_name: context?.entityName || null,
      details: {
        source: context?.source || "workflow-events",
        error: errorMessage,
        ...(context?.details || {}),
      },
    });
  } catch (loggingError) {
    console.error("Failed to log workflow processing error:", loggingError);
  }
};

export const processWorkflowEvents = async (
  limit = 50,
  attempts = 2,
  context?: WorkflowProcessingLogContext,
): Promise<WorkflowProcessingResult> => {
  let lastError = "Failed to process workflow events";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await supabase.functions.invoke("workflow-events", {
        body: { limit },
      });

      if (error) {
        lastError = error.message || "Workflow processing request failed";
      } else {
        return {
          success: true,
          processedEvents: data?.processedEvents,
          matchedRuns: data?.matchedRuns,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Failed to process workflow events";
      console.error("Failed to process workflow events:", error);
    }

    if (attempt < attempts) {
      await delay(400 * attempt);
    }
  }

  await logWorkflowProcessingFailure(lastError, context);
  return { success: false, error: lastError };
};
