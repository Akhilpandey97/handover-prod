import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Project, ProjectChecklist, ResponsibilityLog, ChecklistResponsibilityLog, TransferRecord, ResponsibilityParty, ProjectPhase } from "@/data/projectsData";
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

      checklistItems?.forEach((item) => {
        const projectChecklists = checklistByProject.get(item.project_id) || [];
        const itemLogs = checklistLogs?.filter((log) => log.checklist_item_id === item.id) || [];
        projectChecklists.push({
          ...item,
          responsibility_logs: itemLogs.map((log) => ({
            id: log.id,
            party: log.party,
            startedAt: log.started_at,
            endedAt: log.ended_at || undefined,
          })),
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

      // When completing an item, check if all items in that team section are now done
      if (completed) {
        // Get the completed item to find its owner_team
        const { data: completedItem } = await supabase
          .from("checklist_items")
          .select("owner_team")
          .eq("id", checklistId)
          .single();

        if (completedItem) {
          // Check if all items for this team in this project are now completed
          const { data: teamItems } = await supabase
            .from("checklist_items")
            .select("id, completed, current_responsibility")
            .eq("project_id", projectId)
            .eq("owner_team", completedItem.owner_team);

          const allCompleted = teamItems?.every(item => item.completed);

          if (allCompleted && teamItems) {
            // Set all items in this team to neutral and close open responsibility logs
            for (const item of teamItems) {
              if (item.current_responsibility !== "neutral") {
                // Close open responsibility log
                const { data: openLogs } = await supabase
                  .from("checklist_responsibility_logs")
                  .select("id")
                  .eq("checklist_item_id", item.id)
                  .is("ended_at", null);

                if (openLogs && openLogs.length > 0) {
                  await supabase
                    .from("checklist_responsibility_logs")
                    .update({ ended_at: new Date().toISOString() })
                    .eq("id", openLogs[0].id);
                }

                // Set item to neutral
                await supabase
                  .from("checklist_items")
                  .update({ current_responsibility: "neutral" })
                  .eq("id", item.id);
              }
            }
          }
        }
      }

      return { projectId, checklistId, completed };
    },
    onSuccess: () => {
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
