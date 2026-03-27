import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Project, ProjectChecklist, ResponsibilityLog, ChecklistResponsibilityLog, TransferRecord, ResponsibilityParty, ProjectPhase, ProjectState } from "@/data/projectsData";
import type { TeamRole } from "@/data/teams";
import { teamLabels } from "@/data/teams";
import { sendNotification } from "@/utils/sendNotification";
import { processWorkflowEvents } from "@/utils/processWorkflowEvents";

// Transform database row to Project type
const transformDbProject = (row: any): Project => ({
  id: row.id,
  merchantName: row.merchant_name,
  mid: row.mid,
  platform: row.platform || "Custom",
  arr: Number(row.arr) || 0,
  txnsPerDay: row.txns_per_day || 0,
  aov: Number(row.aov) || 0,
  category: row.category || "",
  currentPhase: row.current_phase as ProjectPhase,
  currentOwnerTeam: row.current_owner_team as TeamRole,
  pendingAcceptance: row.pending_acceptance || false,
  goLivePercent: row.go_live_percent || 0,
  links: {
    brandUrl: row.brand_url || "",
    jiraLink: row.jira_link || "",
    brdLink: row.brd_link || "",
    mintChecklistLink: row.mint_checklist_link || "",
    integrationChecklistLink: row.integration_checklist_link || "",
  },
  dates: {
    kickOffDate: row.kick_off_date,
    goLiveDate: row.go_live_date || undefined,
    expectedGoLiveDate: row.expected_go_live_date || undefined,
  },
  notes: {
    mintNotes: row.mint_notes || "",
    projectNotes: row.project_notes || "",
    currentPhaseComment: row.current_phase_comment || "",
    phase2Comment: row.phase2_comment || "",
  },
  transferHistory: row.transfer_history || [],
  checklist: row.checklist_items || [],
  salesSpoc: row.sales_spoc || "",
  integrationType: row.integration_type || "Standard",
  pgOnboarding: row.pg_onboarding || "",
  currentResponsibility: (row.current_responsibility as ResponsibilityParty) || "neutral",
  responsibilityLog: row.responsibility_logs || [],
  assignedOwner: row.assigned_owner || undefined,
  projectState: (row.project_state as ProjectState) || "not_started",
  assignedOwnerName: row.assigned_owner_name || undefined,
});

// Transform checklist item from database
const transformDbChecklistItem = (row: any): ProjectChecklist => ({
  id: row.id,
  title: row.title,
  completed: row.completed || false,
  completedBy: row.completed_by || undefined,
  completedAt: row.completed_at || undefined,
  phase: row.phase as ProjectPhase,
  ownerTeam: (row.owner_team || "mint").toLowerCase() as TeamRole,
  currentResponsibility: (row.current_responsibility as ResponsibilityParty) || "neutral",
  responsibilityLog: row.responsibility_logs || [],
  comment: row.comment || undefined,
  commentBy: row.comment_by || undefined,
  commentAt: row.comment_at || undefined,
});

// Fetch all projects with related data
export const useProjectsQuery = () => {
  const { currentUser, isLoading } = useAuth();

  return useQuery({
    queryKey: ["projects", currentUser?.tenantId ?? "no-tenant"],
    enabled: !isLoading && !!currentUser?.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const PAGE_SIZE = 1000;

      const fetchAllChecklistItems = async () => {
        const all: any[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("checklist_items")
            .select("*")
            .order("project_id", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) break;
        }
        return all;
      };

      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      const { data: profiles } = await supabase.from("profiles").select("id, name");
      const profileMap = new Map<string, string>();
      profiles?.forEach((p) => profileMap.set(p.id, p.name));

      const checklistItems = await fetchAllChecklistItems();

      const { data: projectLogs, error: projectLogsError } = await supabase
        .from("project_responsibility_logs")
        .select("*")
        .order("started_at", { ascending: true });

      if (projectLogsError) throw projectLogsError;

      const { data: checklistLogs, error: checklistLogsError } = await supabase
        .from("checklist_responsibility_logs")
        .select("*")
        .order("started_at", { ascending: true });

      if (checklistLogsError) throw checklistLogsError;

      const { data: transfers, error: transfersError } = await supabase
        .from("transfer_history")
        .select("*")
        .order("transferred_at", { ascending: true });

      if (transfersError) throw transfersError;

      const checklistByProject = new Map<string, any[]>();
      const logsByProject = new Map<string, any[]>();
      const transfersByProject = new Map<string, any[]>();
      const checklistLogsByItem = new Map<string, any[]>();

      checklistLogs?.forEach((log) => {
        const logs = checklistLogsByItem.get(log.checklist_item_id) || [];
        logs.push({
          id: log.id,
          party: log.party,
          startedAt: log.started_at,
          endedAt: log.ended_at || undefined,
        });
        checklistLogsByItem.set(log.checklist_item_id, logs);
      });

      checklistItems?.forEach((item) => {
        const projectChecklists = checklistByProject.get(item.project_id) || [];
        projectChecklists.push({
          ...item,
          responsibility_logs: checklistLogsByItem.get(item.id) || [],
        });
        checklistByProject.set(item.project_id, projectChecklists);
      });

      projectLogs?.forEach((log) => {
        const logs = logsByProject.get(log.project_id) || [];
        logs.push({
          id: log.id,
          party: log.party,
          startedAt: log.started_at,
          endedAt: log.ended_at || undefined,
          phase: log.phase,
        });
        logsByProject.set(log.project_id, logs);
      });

      transfers?.forEach((transfer) => {
        const projectTransfers = transfersByProject.get(transfer.project_id) || [];
        projectTransfers.push({
          id: transfer.id,
          fromTeam: transfer.from_team,
          toTeam: transfer.to_team,
          transferredBy: transfer.transferred_by,
          acceptedBy: transfer.accepted_by || undefined,
          transferredAt: transfer.transferred_at,
          acceptedAt: transfer.accepted_at || undefined,
          notes: transfer.notes || undefined,
        });
        transfersByProject.set(transfer.project_id, projectTransfers);
      });

      return (projects || []).map((project) => {
        const checklistForProject = checklistByProject.get(project.id) || [];
        return transformDbProject({
          ...project,
          checklist_items: checklistForProject.map(transformDbChecklistItem),
          responsibility_logs: logsByProject.get(project.id) || [],
          transfer_history: transfersByProject.get(project.id) || [],
          assigned_owner_name: project.assigned_owner ? profileMap.get(project.assigned_owner) : undefined,
        });
      });
    },
  });
};

// Add project mutation
export const useAddProject = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (project: Project) => {
      // Insert project with tenant_id from current user
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          merchant_name: project.merchantName,
          mid: project.mid,
          platform: project.platform,
          arr: project.arr,
          txns_per_day: project.txnsPerDay,
          aov: project.aov,
          category: project.category,
          current_phase: project.currentPhase,
          current_owner_team: project.currentOwnerTeam,
          pending_acceptance: project.pendingAcceptance,
          go_live_percent: project.goLivePercent,
          brand_url: project.links.brandUrl,
          jira_link: project.links.jiraLink,
          brd_link: project.links.brdLink,
          mint_checklist_link: project.links.mintChecklistLink,
          integration_checklist_link: project.links.integrationChecklistLink,
          kick_off_date: project.dates.kickOffDate,
          go_live_date: project.dates.goLiveDate,
          expected_go_live_date: project.dates.expectedGoLiveDate,
          mint_notes: project.notes.mintNotes,
          project_notes: project.notes.projectNotes,
          current_phase_comment: project.notes.currentPhaseComment,
          phase2_comment: project.notes.phase2Comment,
          sales_spoc: project.salesSpoc,
          integration_type: project.integrationType,
          pg_onboarding: project.pgOnboarding,
          current_responsibility: project.currentResponsibility,
          project_state: project.projectState,
          tenant_id: currentUser?.tenantId || null,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Fetch checklist templates from dedicated templates table
      const { data: templateItems } = await supabase
        .from("checklist_templates")
        .select("title, owner_team, phase, sort_order")
        .eq("tenant_id", currentUser?.tenantId)
        .order("sort_order", { ascending: true });

      if (templateItems && templateItems.length > 0) {
        const checklistToInsert = templateItems.map((item, index) => ({
          project_id: newProject.id,
          title: item.title,
          completed: false,
          phase: item.phase as "mint" | "integration" | "ms" | "completed",
          owner_team: item.owner_team as "mint" | "integration" | "ms" | "manager" | "super_admin",
          current_responsibility: "neutral" as const,
          sort_order: item.sort_order ?? index,
          tenant_id: currentUser?.tenantId || null,
        }));

        const { error: checklistError } = await supabase
          .from("checklist_items")
          .insert(checklistToInsert);

        if (checklistError) throw checklistError;
      }

      // Insert initial responsibility log
      if (project.responsibilityLog.length > 0) {
        const logsToInsert = project.responsibilityLog.map((log) => ({
          project_id: newProject.id,
          party: log.party,
          phase: log.phase,
          started_at: log.startedAt,
          ended_at: log.endedAt || null,
          tenant_id: currentUser?.tenantId || null,
        }));

        const { error: logError } = await supabase
          .from("project_responsibility_logs")
          .insert(logsToInsert);

        if (logError) throw logError;
      }

      return newProject;
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created successfully");
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    },
  });
};

// Update project mutation
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: Project) => {
      const { error } = await supabase
        .from("projects")
        .update({
          merchant_name: project.merchantName,
          mid: project.mid,
          platform: project.platform,
          arr: project.arr,
          txns_per_day: project.txnsPerDay,
          aov: project.aov,
          category: project.category,
          current_phase: project.currentPhase,
          current_owner_team: project.currentOwnerTeam,
          pending_acceptance: project.pendingAcceptance,
          go_live_percent: project.goLivePercent,
          brand_url: project.links.brandUrl,
          jira_link: project.links.jiraLink,
          brd_link: project.links.brdLink,
          mint_checklist_link: project.links.mintChecklistLink,
          integration_checklist_link: project.links.integrationChecklistLink,
          kick_off_date: project.dates.kickOffDate,
          go_live_date: project.dates.goLiveDate,
          expected_go_live_date: project.dates.expectedGoLiveDate,
          mint_notes: project.notes.mintNotes,
          project_notes: project.notes.projectNotes,
          current_phase_comment: project.notes.currentPhaseComment,
          phase2_comment: project.notes.phase2Comment,
          sales_spoc: project.salesSpoc,
          integration_type: project.integrationType,
          pg_onboarding: project.pgOnboarding,
          current_responsibility: project.currentResponsibility,
          project_state: project.projectState,
        })
        .eq("id", project.id);

      if (error) throw error;
      return project;
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    },
  });
};

// Delete project mutation
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    },
  });
};

// Accept project mutation
export const useAcceptProject = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .update({
          pending_acceptance: false,
          assigned_owner: currentUser?.id || null,
        })
        .eq("id", projectId);

      if (error) throw error;
      return projectId;
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project accepted successfully");
    },
    onError: (error) => {
      console.error("Error accepting project:", error);
      toast.error("Failed to accept project");
    },
  });
};

// Transfer project mutation
export const useTransferProject = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, notes, assigneeId }: { projectId: string; notes?: string; assigneeId?: string }) => {
      const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("current_owner_team, merchant_name")
        .eq("id", projectId)
        .single();

      if (fetchError) throw fetchError;

      const nextTeam: TeamRole = project.current_owner_team === "mint" ? "integration" : "ms";

      const { error: transferError } = await supabase
        .from("transfer_history")
        .insert({
          project_id: projectId,
          from_team: project.current_owner_team,
          to_team: nextTeam,
          transferred_by: currentUser?.name || "Unknown",
          notes,
          tenant_id: currentUser?.tenantId || null,
        });

      if (transferError) throw transferError;

      const { error: projectError } = await supabase
        .from("projects")
        .update({
          current_owner_team: nextTeam,
          current_phase: nextTeam,
          pending_acceptance: true,
          assigned_owner: assigneeId || null,
          current_phase_comment: assigneeId ? `Assigned to user ${assigneeId}` : null,
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      if (assigneeId) {
        const { data: assigneeProfile } = await supabase
          .from("profiles")
          .select("email, name")
          .eq("id", assigneeId)
          .maybeSingle();

        if (assigneeProfile?.email && assigneeProfile?.name) {
          await sendNotification({
            type: "project_assignment",
            recipientEmail: assigneeProfile.email,
            recipientName: assigneeProfile.name,
            projectName: project.merchant_name,
            toTeam: teamLabels[nextTeam],
            assignedBy: currentUser?.name || "Unknown",
          });
        }
      }

      return projectId;
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project transferred successfully");
    },
    onError: (error) => {
      console.error("Error transferring project:", error);
      toast.error("Failed to transfer project");
    },
  });
};

// Reject project mutation
export const useRejectProject = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("current_owner_team, merchant_name")
        .eq("id", projectId)
        .single();

      if (fetchError) throw fetchError;

      const previousTeam: TeamRole = project.current_owner_team === "ms" ? "integration" : "mint";

      const { error: transferError } = await supabase
        .from("transfer_history")
        .insert({
          project_id: projectId,
          from_team: project.current_owner_team,
          to_team: previousTeam,
          transferred_by: currentUser?.name || "Unknown",
          notes: `REJECTED: ${reason}`,
          tenant_id: currentUser?.tenantId || null,
        });

      if (transferError) throw transferError;

      const { error: projectError } = await supabase
        .from("projects")
        .update({
          current_owner_team: previousTeam,
          current_phase: previousTeam,
          pending_acceptance: false,
          assigned_owner: null,
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      return projectId;
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project sent back successfully");
    },
    onError: (error) => {
      console.error("Error rejecting project:", error);
      toast.error("Failed to reject project");
    },
  });
};

// Update checklist mutation
export const useUpdateChecklist = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, checklistId, completed }: { projectId: string; checklistId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          completed,
          completed_by: completed ? currentUser?.name || null : null,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", checklistId);

      if (error) throw error;
      return { projectId, checklistId, completed };
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error updating checklist:", error);
      toast.error("Failed to update checklist");
    },
  });
};

// Update checklist comment mutation
export const useUpdateChecklistComment = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ checklistId, comment }: { checklistId: string; comment: string }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          comment,
          comment_by: currentUser?.name || null,
          comment_at: new Date().toISOString(),
        })
        .eq("id", checklistId);

      if (error) throw error;
      return { checklistId, comment };
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Comment saved");
    },
    onError: (error) => {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    },
  });
};

// Toggle project responsibility mutation
export const useToggleResponsibility = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, party, currentPhase }: { projectId: string; party: ResponsibilityParty; currentPhase: ProjectPhase }) => {
      const now = new Date().toISOString();

      const { error: endError } = await supabase
        .from("project_responsibility_logs")
        .update({ ended_at: now })
        .eq("project_id", projectId)
        .is("ended_at", null);

      if (endError) throw endError;

      const { error: logError } = await supabase.from("project_responsibility_logs").insert({
        project_id: projectId,
        party,
        phase: currentPhase,
        started_at: now,
        tenant_id: currentUser?.tenantId || null,
      });

      if (logError) throw logError;

      const { error: projectError } = await supabase
        .from("projects")
        .update({ current_responsibility: party })
        .eq("id", projectId);

      if (projectError) throw projectError;
      return { projectId, party };
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error toggling responsibility:", error);
      toast.error("Failed to update responsibility");
    },
  });
};

// Toggle checklist responsibility mutation
export const useToggleChecklistResponsibility = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ checklistId, party }: { checklistId: string; party: ResponsibilityParty }) => {
      const now = new Date().toISOString();

      const { error: endError } = await supabase
        .from("checklist_responsibility_logs")
        .update({ ended_at: now })
        .eq("checklist_item_id", checklistId)
        .is("ended_at", null);

      if (endError) throw endError;

      const { error: logError } = await supabase.from("checklist_responsibility_logs").insert({
        checklist_item_id: checklistId,
        party,
        started_at: now,
        tenant_id: currentUser?.tenantId || null,
      });

      if (logError) throw logError;

      const { error: itemError } = await supabase
        .from("checklist_items")
        .update({ current_responsibility: party })
        .eq("id", checklistId);

      if (itemError) throw itemError;
      return { checklistId, party };
    },
    onSuccess: async () => {
      await processWorkflowEvents();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error toggling checklist responsibility:", error);
      toast.error("Failed to update checklist responsibility");
    },
  });
};
