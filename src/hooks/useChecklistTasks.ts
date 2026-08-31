import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChecklistTask {
  id: string;
  checklist_item_id: string;
  project_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  assignee: string | null;
  sort_order: number | null;
  completed_at: string | null;
  completed_by: string | null;
}

const db = () => (supabase as any).from("checklist_tasks");

export const useChecklistTasks = (projectId?: string) => {
  return useQuery({
    queryKey: ["checklist-tasks", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ChecklistTask[]> => {
      const { data, error } = await db()
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ChecklistTask[];
    },
  });
};

export const useChecklistTaskMutations = (projectId?: string) => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["checklist-tasks", projectId] });

  const addTask = useMutation({
    mutationFn: async (input: { checklistItemId: string; title: string; dueDate?: string | null }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", currentUser?.id || "")
        .maybeSingle();

      const { error } = await db().insert({
        checklist_item_id: input.checklistItemId,
        project_id: projectId,
        tenant_id: (profile as any)?.tenant_id ?? null,
        title: input.title,
        due_date: input.dueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleTask = useMutation({
    mutationFn: async (input: { id: string; completed: boolean }) => {
      const { error } = await db()
        .update({
          completed: input.completed,
          completed_at: input.completed ? new Date().toISOString() : null,
          completed_by: input.completed ? currentUser?.name || null : null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: async (input: { id: string; title?: string; dueDate?: string | null }) => {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      const { error } = await db().update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addTask, toggleTask, updateTask, deleteTask };
};

export const useUpdateChecklistDueDate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { checklistItemId: string; dueDate: string | null }) => {
      const { error } = await (supabase as any)
        .from("checklist_items")
        .update({ due_date: input.dueDate })
        .eq("id", input.checklistItemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
};
