import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Project, ProjectPhase, ProjectChecklist } from "@/data/projectsData";

export interface PhaseRule {
  id: string;
  name: string;
  requiredTitles: string[];
  matchMode: "all" | "any";
  targetPhase: ProjectPhase;
  priority: number;
  isActive: boolean;
}

const mapRow = (row: {
  id: string;
  name: string;
  required_titles: string[];
  match_mode: string;
  target_phase: ProjectPhase;
  priority: number;
  is_active: boolean;
}): PhaseRule => ({
  id: row.id,
  name: row.name,
  requiredTitles: row.required_titles || [],
  matchMode: row.match_mode === "any" ? "any" : "all",
  targetPhase: row.target_phase,
  priority: row.priority,
  isActive: row.is_active,
});

/**
 * Evaluates tenant-defined phase rules against a project's checklist.
 * Highest priority matching rule wins. Returns null when nothing matches.
 */
export const evaluatePhaseRules = (
  checklist: ProjectChecklist[],
  rules: PhaseRule[],
): ProjectPhase | null => {
  const completed = new Set(
    checklist.filter((item) => item.completed).map((item) => item.title.trim().toLowerCase()),
  );

  const sorted = [...rules]
    .filter((rule) => rule.isActive && rule.requiredTitles.length > 0)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const titles = rule.requiredTitles.map((title) => title.trim().toLowerCase()).filter(Boolean);
    const matched =
      rule.matchMode === "any"
        ? titles.some((title) => completed.has(title))
        : titles.every((title) => completed.has(title));
    if (matched) return rule.targetPhase;
  }

  return null;
};

export const usePhaseRules = () => {
  const { currentUser } = useAuth();
  const [rules, setRules] = useState<PhaseRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("phase_rules")
      .select("*")
      .order("priority", { ascending: false });
    if (!error && data) setRules(data.map(mapRow));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const saveRule = useCallback(
    async (rule: Omit<PhaseRule, "id"> & { id?: string }) => {
      const payload = {
        name: rule.name,
        required_titles: rule.requiredTitles,
        match_mode: rule.matchMode,
        target_phase: rule.targetPhase,
        priority: rule.priority,
        is_active: rule.isActive,
        tenant_id: currentUser?.tenantId || null,
        created_by: currentUser?.id || null,
      };
      const { error } = rule.id
        ? await supabase.from("phase_rules").update(payload).eq("id", rule.id)
        : await supabase.from("phase_rules").insert(payload);
      if (error) throw error;
      await fetchRules();
    },
    [currentUser?.tenantId, currentUser?.id, fetchRules],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("phase_rules").delete().eq("id", id);
      if (error) throw error;
      await fetchRules();
    },
    [fetchRules],
  );

  const resolvePhase = useCallback(
    (project: Project) => evaluatePhaseRules(project.checklist, rules),
    [rules],
  );

  return { rules, isLoading, refresh: fetchRules, saveRule, deleteRule, resolvePhase };
};
