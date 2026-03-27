import { supabase } from "@/integrations/supabase/client";

const WORKFLOW_EVENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-events`;

export const processWorkflowEvents = async (limit = 50) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  await fetch(WORKFLOW_EVENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ limit }),
  }).catch((error) => {
    console.error("Failed to process workflow events:", error);
  });
};
