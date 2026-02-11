import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Project, ProjectChecklist, ResponsibilityLog, ChecklistResponsibilityLog, TransferRecord, ResponsibilityParty, ProjectPhase, ProjectState } from "@/data/projectsData";
import type { TeamRole } from "@/data/teams";

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
  return useQuery({
    queryKey: ["projects"],
    staleTime: 60_000, // 60s — avoid refetching on every re-mount
    gcTime: 5 * 60_000, // 5 min garbage collection
    queryFn: async () => {
      const PAGE_SIZE = 1000;

      const fetchAllChecklistItems = async () => {
        const all: any[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("checklist_items")
            .select("*")
            // IMPORTANT: ordering only by sort_order will group many projects together and,
            // combined with the 1000-row limit, can drop later checklist rows (e.g. Integration).
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

      // Fetch projects
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch profiles for owner name lookup
      const { data: profiles } = await supabase.from("profiles").select("id, name");
      const profileMap = new Map<string, string>();
      profiles?.forEach(p => profileMap.set(p.id, p.name));

      // Fetch all checklist items (paginated to avoid 1000-row limit dropping Integration rows)
      const checklistItems = await fetchAllChecklistItems();

      // Fetch project responsibility logs
      const { data: projectLogs, error: projectLogsError } = await supabase
        .from("project_responsibility_logs")
        .select("*")
        .order("started_at", { ascending: true });

      if (projectLogsError) throw projectLogsError;

      // Fetch checklist responsibility logs
      const { data: checklistLogs, error: checklistLogsError } = await supabase
        .from("checklist_responsibility_logs")
        .select("*")
        .order("started_at", { ascending: true });

      if (checklistLogsError) throw checklistLogsError;

      // Fetch transfer history
      const { data: transfers, error: transfersError } = await supabase
        .from("transfer_history")
        .select("*")
        .order("transferred_at", { ascending: true });

      if (transfersError) throw transfersError;

      // Group data by project
      const checklistByProject = new Map<string, any[]>();
      const logsByProject = new Map<string, any[]>();
      const logsByChecklist = new Map<string, any[]>();
      const transfersByProject = new Map<string, any[]>();

      // Pre-group checklist logs by checklist_item_id for O(1) lookup
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

      // Transform and combine
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

  return useMutation({
    mutationFn: async (project: Project) => {
      // Insert project
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
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Insert checklist items
      if (project.checklist.length > 0) {
        const checklistToInsert = project.checklist.map((item, index) => ({
          project_id: newProject.id,
          title: item.title,
          completed: item.completed,
          phase: item.phase,
          owner_team: item.ownerTeam,
          current_responsibility: item.currentResponsibility,
          sort_order: index,
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
        }));

        const { error: logError } = await supabase
          .from("project_responsibility_logs")
          .insert(logsToInsert);

        if (logError) throw logError;
      }

      return newProject;
    },
    onSuccess: () => {
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
    onSuccess: () => {
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
      // Delete checklist responsibility logs first
      const { data: checklistItems } = await supabase
        .from("checklist_items")
        .select("id")
        .eq("project_id", projectId);

      if (checklistItems && checklistItems.length > 0) {
        const checklistIds = checklistItems.map(c => c.id);
        await supabase
          .from("checklist_responsibility_logs")
          .delete()
          .in("checklist_item_id", checklistIds);

        await supabase
          .from("checklist_comments")
          .delete()
          .in("checklist_item_id", checklistIds);
      }

      // Delete related records
      await supabase.from("checklist_items").delete().eq("project_id", projectId);
      await supabase.from("project_responsibility_logs").delete().eq("project_id", projectId);
      await supabase.from("transfer_history").delete().eq("project_id", projectId);

      // Delete project
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
      // Update project
      const { error: projectError } = await supabase
        .from("projects")
        .update({ pending_acceptance: false })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // Update the latest transfer record
      const { data: transfers, error: fetchError } = await supabase
        .from("transfer_history")
        .select("*")
        .eq("project_id", projectId)
        .is("accepted_by", null)
        .order("transferred_at", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (transfers && transfers.length > 0) {
        const { error: updateError } = await supabase
          .from("transfer_history")
          .update({
            accepted_by: currentUser?.name || "Unknown",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", transfers[0].id);

        if (updateError) throw updateError;
      }

      return projectId;
    },
    onSuccess: () => {
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
      if (!currentUser) throw new Error("Not authenticated");

      const getNextTeam = (current: TeamRole): TeamRole | null => {
        if (current === "mint") return "integration";
        if (current === "integration") return "ms";
        return null;
      };

      const nextTeam = getNextTeam(currentUser.team);
      if (!nextTeam) throw new Error("Cannot transfer from this team");

      const nextPhase = nextTeam === "integration" ? "integration" : nextTeam === "ms" ? "ms" : undefined;

      // Update project with new owner
      const { error: projectError } = await supabase
        .from("projects")
        .update({
          current_owner_team: nextTeam,
          current_phase: nextPhase,
          pending_acceptance: true,
          assigned_owner: assigneeId || null,
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // Create transfer record
      const { error: transferError } = await supabase
        .from("transfer_history")
        .insert({
          project_id: projectId,
          from_team: currentUser.team,
          to_team: nextTeam,
          transferred_by: currentUser.name,
          notes,
        });

      if (transferError) throw transferError;

      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project transferred successfully");
    },
    onError: (error) => {
      console.error("Error transferring project:", error);
      toast.error("Failed to transfer project");
    },
  });
};

// Reject project transfer — sends project back to previous team
export const useRejectProject = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      if (!currentUser) throw new Error("Not authenticated");

      const getPreviousTeam = (current: TeamRole): TeamRole | null => {
        if (current === "integration") return "mint";
        if (current === "ms") return "integration";
        return null;
      };

      const previousTeam = getPreviousTeam(currentUser.team);
      if (!previousTeam) throw new Error("Cannot reject from this team");

      const previousPhase = previousTeam as "mint" | "integration" | "ms";

      // Find the last transfer record to get the previous owner
      const { data: lastTransfer } = await supabase
        .from("transfer_history")
        .select("transferred_by, from_team")
        .eq("project_id", projectId)
        .eq("to_team", currentUser.team)
        .order("transferred_at", { ascending: false })
        .limit(1)
        .single();

      // Look up the previous assigned_owner from the project's history
      // We need to find who owned it before — check the transferred_by user's profile
      let previousOwnerId: string | null = null;
      if (lastTransfer?.transferred_by) {
        const { data: prevOwnerProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("name", lastTransfer.transferred_by)
          .limit(1)
          .single();
        previousOwnerId = prevOwnerProfile?.id || null;
      }

      // Update project back to previous team, active (not pending), with previous owner
      const { error: projectError } = await supabase
        .from("projects")
        .update({
          current_owner_team: previousTeam,
          current_phase: previousPhase,
          pending_acceptance: false,
          assigned_owner: previousOwnerId,
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // Create transfer record for the rejection
      const { error: transferError } = await supabase
        .from("transfer_history")
        .insert({
          project_id: projectId,
          from_team: currentUser.team,
          to_team: previousTeam,
          transferred_by: currentUser.name,
          notes: `REJECTED: ${reason}`,
        });

      if (transferError) throw transferError;

      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project rejected and sent back");
    },
    onError: (error) => {
      console.error("Error rejecting project:", error);
      toast.error("Failed to reject project");
    },
  });
};

// Update checklist item mutation
export const useUpdateChecklist = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({
      projectId,
      checklistId,
      completed,
    }: {
      projectId: string;
      checklistId: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          completed,
          completed_by: completed ? currentUser?.name : null,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", checklistId);

      if (error) throw error;

      // When completing an item, auto-neutral it and close its open time-tracking logs
      if (completed) {
        // Close open responsibility log for this specific item
        const { data: openLogs } = await supabase
          .from("checklist_responsibility_logs")
          .select("id")
          .eq("checklist_item_id", checklistId)
          .is("ended_at", null);

        if (openLogs && openLogs.length > 0) {
          for (const log of openLogs) {
            await supabase
              .from("checklist_responsibility_logs")
              .update({ ended_at: new Date().toISOString() })
              .eq("id", log.id);
          }
        }

        // Set item to neutral
        await supabase
          .from("checklist_items")
          .update({ current_responsibility: "neutral" })
          .eq("id", checklistId);
      }

      return { projectId, checklistId, completed };
    },
    onMutate: async ({ projectId, checklistId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueryData<Project[]>(["projects"]);
      queryClient.setQueryData<Project[]>(["projects"], (old) =>
        old?.map((p) =>
          p.id === projectId
            ? {
                ...p,
                checklist: p.checklist.map((c) =>
                  c.id === checklistId
                    ? { ...c, completed, completedBy: completed ? currentUser?.name : undefined, completedAt: completed ? new Date().toISOString() : undefined }
                    : c
                ),
              }
            : p
        )
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projects"], context.previous);
      console.error("Error updating checklist:", error);
      toast.error("Failed to update checklist");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

// Update checklist comment mutation
export const useUpdateChecklistComment = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({
      checklistId,
      comment,
    }: {
      checklistId: string;
      comment: string;
    }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({
          comment,
          comment_by: currentUser?.name,
          comment_at: new Date().toISOString(),
        })
        .eq("id", checklistId);

      if (error) throw error;
      return { checklistId, comment };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
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

  return useMutation({
    mutationFn: async ({
      projectId,
      party,
      currentPhase,
    }: {
      projectId: string;
      party: ResponsibilityParty;
      currentPhase: ProjectPhase;
    }) => {
      // Close current log entry
      const { data: currentLogs, error: fetchError } = await supabase
        .from("project_responsibility_logs")
        .select("*")
        .eq("project_id", projectId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (currentLogs && currentLogs.length > 0) {
        const { error: updateError } = await supabase
          .from("project_responsibility_logs")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", currentLogs[0].id);

        if (updateError) throw updateError;
      }

      // Create new log entry
      const { error: insertError } = await supabase
        .from("project_responsibility_logs")
        .insert({
          project_id: projectId,
          party,
          phase: currentPhase,
          started_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Update project current responsibility
      const { error: projectError } = await supabase
        .from("projects")
        .update({ current_responsibility: party })
        .eq("id", projectId);

      if (projectError) throw projectError;

      return { projectId, party };
    },
    onSuccess: () => {
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

  return useMutation({
    mutationFn: async ({
      checklistId,
      party,
    }: {
      checklistId: string;
      party: ResponsibilityParty;
    }) => {
      // Close current log entry
      const { data: currentLogs, error: fetchError } = await supabase
        .from("checklist_responsibility_logs")
        .select("*")
        .eq("checklist_item_id", checklistId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (currentLogs && currentLogs.length > 0) {
        const { error: updateError } = await supabase
          .from("checklist_responsibility_logs")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", currentLogs[0].id);

        if (updateError) throw updateError;
      }

      // Create new log entry
      const { error: insertError } = await supabase
        .from("checklist_responsibility_logs")
        .insert({
          checklist_item_id: checklistId,
          party,
          started_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Update checklist item current responsibility
      const { error: checklistError } = await supabase
        .from("checklist_items")
        .update({ current_responsibility: party })
        .eq("id", checklistId);

      if (checklistError) throw checklistError;

      return { checklistId, party };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error toggling checklist responsibility:", error);
      toast.error("Failed to update responsibility");
    },
  });
};
