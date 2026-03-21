import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Fetch fresh session token if not provided
export const fetchAiInsights = async (body: Record<string, unknown>, accessToken?: string): Promise<string> => {
  let token = accessToken;
  
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("User not authenticated");
    }
    token = session.access_token;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-project-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error("Rate limit exceeded. Please try again in a moment.");
  }
  if (res.status === 402) {
    throw new Error("AI credits exhausted. Please add credits.");
  }
  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status}`);
  }

  const data = await res.json();
  return data?.result || "Unable to generate insights.";
};
