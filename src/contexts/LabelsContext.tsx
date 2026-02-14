import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Default labels - used as fallback when DB has no overrides
const DEFAULT_LABELS: Record<string, string> = {
  // General
  app_title: "Manager Dashboard",
  app_subtitle: "Project Management Hub",
  org_name: "GoKwik",

  // Team labels
  team_mint: "MINT (Presales)",
  team_integration: "Integration Team",
  team_ms: "MS (Merchant Success)",
  team_manager: "Manager",

  // Responsibility labels
  responsibility_internal: "GoKwik",
  responsibility_external: "Merchant",
  responsibility_neutral: "Neutral",

  // Phase labels
  phase_mint: "MINT",
  phase_integration: "Integration",
  phase_ms: "MS",
  phase_completed: "Completed",

  // State labels
  state_not_started: "Not Started",
  state_on_hold: "On-Hold",
  state_in_progress: "In Progress",
  state_live: "Live",
  state_blocked: "Blocked",

  // Field labels
  field_merchant_name: "Merchant Name",
  field_mid: "MID",
  field_kick_off_date: "Start Date (Kick Off)",
  field_go_live_date: "Go-Live Date",
  field_arr: "ARR",
  field_platform: "Platform",
  field_integration_type: "Integration Type",
  field_sales_spoc: "Sales SPOC",
  field_assigned_owner: "Assigned Owner",
  field_project_notes: "Project Notes",
};

interface LabelsContextType {
  labels: Record<string, string>;
  getLabel: (key: string) => string;
  updateLabel: (key: string, value: string) => Promise<void>;
  updateLabels: (updates: Record<string, string>) => Promise<void>;
  isLoading: boolean;
  // Convenience getters
  teamLabels: Record<string, string>;
  responsibilityLabels: Record<string, string>;
  phaseLabels: Record<string, string>;
  stateLabels: Record<string, string>;
}

const LabelsContext = createContext<LabelsContextType | null>(null);

export const useLabels = () => {
  const ctx = useContext(LabelsContext);
  if (!ctx) throw new Error("useLabels must be used within LabelsProvider");
  return ctx;
};

export const LabelsProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_LABELS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        let query = supabase.from("app_settings").select("key, value");
        if (currentUser?.tenantId) {
          query = query.eq("tenant_id", currentUser.tenantId);
        }
        const { data, error } = await query;
        if (!error && data) {
          const merged = { ...DEFAULT_LABELS };
          data.forEach((row: { key: string; value: string }) => {
            merged[row.key] = row.value;
          });
          setLabels(merged);
        }
      } catch (e) {
        console.error("Failed to fetch labels:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLabels();
  }, [currentUser?.tenantId]);

  const getLabel = useCallback((key: string) => labels[key] || DEFAULT_LABELS[key] || key, [labels]);

  const updateLabel = useCallback(async (key: string, value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value, category: key.split("_")[0], tenant_id: currentUser?.tenantId || null }, { onConflict: "key,tenant_id" });
    if (!error) {
      setLabels((prev) => ({ ...prev, [key]: value }));
    }
  }, [currentUser?.tenantId]);

  const updateLabels = useCallback(async (updates: Record<string, string>) => {
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      category: key.includes("_") ? key.substring(0, key.indexOf("_")) : "general",
      tenant_id: currentUser?.tenantId || null,
    }));
    const { error } = await supabase
      .from("app_settings")
      .upsert(rows, { onConflict: "key,tenant_id" });
    if (!error) {
      setLabels((prev) => ({ ...prev, ...updates }));
    }
  }, [currentUser?.tenantId]);

  const teamLabels: Record<string, string> = {
    mint: labels.team_mint,
    integration: labels.team_integration,
    ms: labels.team_ms,
    manager: labels.team_manager,
    super_admin: "Super Admin",
  };

  const responsibilityLabels: Record<string, string> = {
    gokwik: labels.responsibility_internal,
    merchant: labels.responsibility_external,
    neutral: labels.responsibility_neutral,
  };

  const phaseLabels: Record<string, string> = {
    mint: labels.phase_mint,
    integration: labels.phase_integration,
    ms: labels.phase_ms,
    completed: labels.phase_completed,
  };

  const stateLabels: Record<string, string> = {
    not_started: labels.state_not_started,
    on_hold: labels.state_on_hold,
    in_progress: labels.state_in_progress,
    live: labels.state_live,
    blocked: labels.state_blocked,
  };

  return (
    <LabelsContext.Provider
      value={{
        labels,
        getLabel,
        updateLabel,
        updateLabels,
        isLoading,
        teamLabels,
        responsibilityLabels,
        phaseLabels,
        stateLabels,
      }}
    >
      {children}
    </LabelsContext.Provider>
  );
};
