import { supabase } from "@/integrations/supabase/client";

interface NotificationPayload {
  type: "project_assignment" | "project_transfer";
  recipientEmail: string;
  recipientName: string;
  projectName: string;
  fromTeam?: string;
  toTeam?: string;
  notes?: string;
  assignedBy?: string;
}

export const sendNotification = async (payload: NotificationPayload) => {
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: payload,
    });
    if (error) {
      console.error("Notification error:", error);
    }
    return data;
  } catch (err) {
    // Non-blocking — don't break the flow if email fails
    console.error("Failed to send notification:", err);
  }
};
