import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Default labels - used as fallback when DB has no overrides
const DEFAULT_LABELS: Record<string, string> = {
  app_title: "Command Centre",
  app_subtitle: "Enterprise delivery operations",
  org_name: "GoKwik",
  team_mint: "MINT (Presales)",
  team_integration: "Integration Team",
  team_ms: "MS (Merchant Success)",
  team_manager: "Manager",
  responsibility_internal: "GoKwik",
  responsibility_external: "Merchant",
  responsibility_neutral: "Neutral",
  phase_mint: "MINT",
  phase_integration: "Integration",
  phase_ms: "MS",
  phase_completed: "Completed",
  state_not_started: "Not Started",
  state_on_hold: "On-Hold",
  state_in_progress: "In Progress",
  state_live: "Live",
  state_blocked: "Blocked",
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
  field_category: "Category",
  field_brand_url: "Brand URL",
  field_jira_link: "JIRA Link",
  field_brd_link: "BRD Link",
  field_mint_checklist_link: "MINT Checklist Link",
  field_integration_checklist_link: "Integration Checklist Link",
  field_txns_per_day: "Txns/Day",
  field_aov: "AOV",
  field_pg_onboarding: "PG Onboarding",
  field_go_live_percent: "Go Live %",
  field_expected_go_live_date: "Expected Go Live Date",
  field_actual_go_live_date: "Actual Go Live Date",
  field_mint_notes: "MINT Notes",
  field_current_phase_comment: "Current Phase Comment",
  field_phase2_comment: "Phase 2 Comment",
  color_team_mint_badge: "#2f6fed",
  color_team_integration_badge: "#6a5af9",
  color_team_ms_badge: "#0f9f6e",
  color_team_completed_badge: "#5f6b7a",
  color_card_mint_bg: "#eef4ff",
  color_card_integration_bg: "#f3f1ff",
  color_card_ms_bg: "#edf9f4",
  color_card_completed_bg: "#f4f7fb",
  color_project_strip_bg: "#f8fbff",
  color_project_strip_border: "#d9e4f2",
  color_project_strip_outer_bg: "#bfdbfe",
  color_project_strip_outer_border: "#60a5fa",
  color_project_expanded_bg: "#fdfefe",
  color_project_expanded_border: "#dce6ef",
  color_workspace_main_bg: "#f8fbff",
  color_workspace_main_border: "#d9e4f2",
  color_workspace_section_bg: "#fcfdff",
  color_workspace_section_border: "#dbe5ef",
  color_workspace_metric_bg: "#ffffff",
  color_workspace_metric_border: "#dce4ee",
  color_state_not_started: "#5f6b7a",
  color_state_on_hold: "#d88a1d",
  color_state_in_progress: "#2f6fed",
  color_state_live: "#0f9f6e",
  color_state_blocked: "#d84b4b",
  color_kpi_total: "#2f6fed",
  color_kpi_pending: "#d88a1d",
  color_kpi_active: "#265fd1",
  color_kpi_live: "#0f9f6e",
  color_team_perf_total: "#5f6b7a",
  color_team_perf_pending: "#d88a1d",
  color_team_perf_active: "#2f6fed",
  color_team_perf_completed: "#0f9f6e",
  color_time_internal: "#2f6fed",
  color_time_external: "#d88a1d",
};

interface LabelsContextType {
  labels: Record<string, string>;
  getLabel: (key: string) => string;
  updateLabel: (key: string, value: string) => Promise<void>;
  updateLabels: (updates: Record<string, string>) => Promise<void>;
  isLoading: boolean;
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
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_LABELS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      if (isAuthLoading) return;

      if (!currentUser?.tenantId) {
        setLabels(DEFAULT_LABELS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key, value")
          .eq("tenant_id", currentUser.tenantId);

        if (!error && data) {
          const merged = { ...DEFAULT_LABELS };
          data.forEach((row: { key: string; value: string }) => {
            merged[row.key] = row.value;
          });
          setLabels(merged);
        } else {
          setLabels(DEFAULT_LABELS);
        }
      } catch (e) {
        console.error("Failed to fetch labels:", e);
        setLabels(DEFAULT_LABELS);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLabels();
  }, [currentUser?.tenantId, isAuthLoading]);

  const getLabel = useCallback((key: string) => labels[key] || DEFAULT_LABELS[key] || key, [labels]);

  const updateLabel = useCallback(
    async (key: string, value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, category: key.split("_")[0], tenant_id: currentUser?.tenantId || null }, { onConflict: "key,tenant_id" });
      if (!error) {
        setLabels((prev) => ({ ...prev, [key]: value }));
      }
    },
    [currentUser?.tenantId],
  );

  const updateLabels = useCallback(
    async (updates: Record<string, string>) => {
      const rows = Object.entries(updates).map(([key, value]) => ({
        key,
        value,
        category: key.includes("_") ? key.substring(0, key.indexOf("_")) : "general",
        tenant_id: currentUser?.tenantId || null,
      }));
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key,tenant_id" });
      if (!error) {
        setLabels((prev) => ({ ...prev, ...updates }));
      }
    },
    [currentUser?.tenantId],
  );

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
