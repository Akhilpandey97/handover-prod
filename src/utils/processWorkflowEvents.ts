import { supabase } from "@/integrations/supabase/client";

type WorkflowProcessingResult = {
  success: boolean;
  processedEvents?: number;
  matchedRuns?: number;
  error?: string;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const processWorkflowEvents = async (limit = 50, attempts = 2): Promise<WorkflowProcessingResult> => {
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

  return { success: false, error: lastError };
};
