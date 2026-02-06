import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TeamRole, teamLabels } from "@/data/teams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Save,
  X,
  ClipboardList,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface ChecklistTemplate {
  id: string;
  title: string;
  ownerTeam: TeamRole;
  phase: string;
  sortOrder: number;
}

// Fetch all unique checklist items grouped by team (as templates)
const useChecklistTemplates = () => {
  return useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      // Get distinct checklist items by title and owner_team
      const { data, error } = await supabase
        .from("checklist_items")
        .select("title, owner_team, phase, sort_order")
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // Group by team and deduplicate
      const templates = new Map<string, ChecklistTemplate>();
      (data || []).forEach((item, index) => {
        const key = `${item.owner_team}-${item.title}`;
        if (!templates.has(key)) {
          templates.set(key, {
            id: key,
            title: item.title,
            ownerTeam: item.owner_team as TeamRole,
            phase: item.phase,
            sortOrder: item.sort_order ?? index,
          });
        }
      });

      return Array.from(templates.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });
};

export const ChecklistManagement = () => {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useChecklistTemplates();
  const [activeTeam, setActiveTeam] = useState<TeamRole>("mint");
  const [editingItem, setEditingItem] = useState<ChecklistTemplate | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ChecklistTemplate | null>(null);

  // Filter templates by team
  const teamTemplates = templates.filter((t) => t.ownerTeam === activeTeam);

  // Add new checklist item to all projects
  const addItemMutation = useMutation({
    mutationFn: async ({ title, team }: { title: string; team: TeamRole }) => {
      // Get all projects
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id");

      if (projectsError) throw projectsError;

      // Get max sort order for this team
      const maxOrder = teamTemplates.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;

      // Insert new checklist item for all projects
      // Phase can only be mint, integration, or ms (not manager)
      const phase = team === "manager" ? "ms" : team;
      const itemsToInsert = (projects || []).map((p) => ({
        project_id: p.id,
        title,
        owner_team: team,
        phase: phase as "mint" | "integration" | "ms",
        sort_order: maxOrder,
        completed: false,
        current_responsibility: "neutral" as const,
      }));

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from("checklist_items").insert(itemsToInsert);
        if (error) throw error;
      }

      return { title, team };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Checklist item added to all projects");
      setIsAddDialogOpen(false);
      setNewItemTitle("");
    },
    onError: (error) => {
      console.error("Error adding checklist item:", error);
      toast.error("Failed to add checklist item");
    },
  });

  // Update checklist item title across all projects
  const updateItemMutation = useMutation({
    mutationFn: async ({ oldTitle, newTitle, team }: { oldTitle: string; newTitle: string; team: TeamRole }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ title: newTitle })
        .eq("title", oldTitle)
        .eq("owner_team", team);

      if (error) throw error;
      return { oldTitle, newTitle, team };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Checklist item updated");
      setEditingItem(null);
    },
    onError: (error) => {
      console.error("Error updating checklist item:", error);
      toast.error("Failed to update checklist item");
    },
  });

  // Delete checklist item from all projects
  const deleteItemMutation = useMutation({
    mutationFn: async ({ title, team }: { title: string; team: TeamRole }) => {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("title", title)
        .eq("owner_team", team);

      if (error) throw error;
      return { title, team };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Checklist item removed from all projects");
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error("Error deleting checklist item:", error);
      toast.error("Failed to delete checklist item");
    },
  });

  // Reorder checklist items
  const reorderMutation = useMutation({
    mutationFn: async ({ title, team, direction }: { title: string; team: TeamRole; direction: "up" | "down" }) => {
      const currentItems = teamTemplates;
      const currentIndex = currentItems.findIndex((t) => t.title === title);
      
      if (currentIndex === -1) return;
      
      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= currentItems.length) return;

      const currentItem = currentItems[currentIndex];
      const swapItem = currentItems[swapIndex];

      // Swap sort orders
      await supabase
        .from("checklist_items")
        .update({ sort_order: swapItem.sortOrder })
        .eq("title", currentItem.title)
        .eq("owner_team", team);

      await supabase
        .from("checklist_items")
        .update({ sort_order: currentItem.sortOrder })
        .eq("title", swapItem.title)
        .eq("owner_team", team);

      return { title, team, direction };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      console.error("Error reordering checklist:", error);
      toast.error("Failed to reorder checklist");
    },
  });

  const handleAddItem = () => {
    if (!newItemTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    addItemMutation.mutate({ title: newItemTitle.trim(), team: activeTeam });
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    const newTitle = editingItem.title.trim();
    if (!newTitle) {
      toast.error("Title cannot be empty");
      return;
    }
    // Find original title
    const original = templates.find((t) => t.id === editingItem.id);
    if (original && original.title !== newTitle) {
      updateItemMutation.mutate({ oldTitle: original.title, newTitle, team: activeTeam });
    } else {
      setEditingItem(null);
    }
  };

  const teams: TeamRole[] = ["mint", "integration", "ms"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Checklist Templates
          </CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage checklist items that appear for all projects. Changes apply globally.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTeam} onValueChange={(v) => setActiveTeam(v as TeamRole)}>
          <div className="border-b px-6 pt-4">
            <TabsList className="h-11 bg-muted/50 p-1">
              {teams.map((team) => (
                <TabsTrigger
                  key={team}
                  value={team}
                  className="gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  {teamLabels[team]}
                  <Badge variant="secondary" className="ml-1 h-5 px-2">
                    {templates.filter((t) => t.ownerTeam === team).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {teams.map((team) => (
            <TabsContent key={team} value={team} className="mt-0">
              <ScrollArea className="h-[400px]">
                <div className="p-6 space-y-2">
                  {templates
                    .filter((t) => t.ownerTeam === team)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((item, index, arr) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors group"
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => reorderMutation.mutate({ title: item.title, team, direction: "up" })}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === arr.length - 1}
                            onClick={() => reorderMutation.mutate({ title: item.title, team, direction: "down" })}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                        
                        <Badge variant="outline" className="w-8 h-6 flex items-center justify-center text-xs font-mono">
                          {index + 1}
                        </Badge>

                        <div className="flex-1">
                          {editingItem?.id === item.id ? (
                            <Input
                              value={editingItem.title}
                              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                              className="h-8"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateItem();
                                if (e.key === "Escape") setEditingItem(null);
                              }}
                            />
                          ) : (
                            <span className="font-medium">{item.title}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingItem?.id === item.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdateItem}>
                                <Save className="h-4 w-4 text-emerald-500" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingItem(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setEditingItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:text-destructive"
                                onClick={() => setDeleteConfirm(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                  {templates.filter((t) => t.ownerTeam === team).length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No checklist items for {teamLabels[team]}</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsAddDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Checklist Item</DialogTitle>
            <DialogDescription>
              This item will be added to all existing and future projects for {teamLabels[activeTeam]} team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Title</label>
              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Enter checklist item title..."
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select value={activeTeam} onValueChange={(v) => setActiveTeam(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team} value={team}>
                      {teamLabels[team]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={addItemMutation.isPending}>
              {addItemMutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Checklist Item
            </DialogTitle>
            <DialogDescription>
              This will permanently remove "{deleteConfirm?.title}" from ALL projects. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteItemMutation.mutate({ title: deleteConfirm.title, team: deleteConfirm.ownerTeam });
                }
              }}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
