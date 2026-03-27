import { supabase } from "@/integrations/supabase/client";

const WORKFLOW_EVENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-events`;

type WorkflowProcessingResult = {
  success: boolean;
  processedEvents?: number;
  matchedRuns?: number;
  error?: string;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const processWorkflowEvents = async (limit = 50, attempts = 2): Promise<WorkflowProcessingResult> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Missing authenticated session" };
  }

  let lastError = "Failed to process workflow events";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(WORKFLOW_EVENTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ limit }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        lastError = payload?.error || `Workflow processing failed with status ${response.status}`;
      } else {
        return {
          success: true,
          processedEvents: payload?.processedEvents,
          matchedRuns: payload?.matchedRuns,
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

  return { success: false, error: lastError };
};
