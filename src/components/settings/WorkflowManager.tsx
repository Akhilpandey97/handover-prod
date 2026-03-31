import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Plus, Pencil, Trash2, Workflow, Zap, Search, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  trigger_field: string;
  trigger_value: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  tenant_id: string | null;
}

const TRIGGER_FIELDS = [
  { value: "project_state", label: "Project State" },
  { value: "current_phase", label: "Current Phase" },
  { value: "current_owner_team", label: "Owner Team" },
  { value: "platform", label: "Platform" },
  { value: "category", label: "Category" },
  { value: "checklist_completed", label: "Checklist Completed" },
  { value: "checklist_all_completed", label: "All Checklist Done" },
  { value: "comment_created", label: "Comment Created" },
];

const ACTION_TYPES = [
  { value: "assign_owner", label: "Assign Owner" },
  { value: "update_field", label: "Update Project Field" },
  { value: "notify", label: "Send Notification" },
  { value: "log", label: "Log Activity" },
  { value: "create_comment", label: "Create Comment" },
  { value: "create_checklist_item", label: "Create Checklist Item" },
];

const emptyForm = {
  name: "",
  description: "",
  trigger_field: "project_state",
  trigger_value: "",
  action_type: "assign_owner",
  action_config: "{}",
  is_active: true,
};

export const WorkflowManager = () => {
  const { currentUser } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("chat_workflows")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setWorkflows(data as unknown as WorkflowRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchWorkflows(); }, []);

  const filtered = workflows.filter(w =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (w: WorkflowRow) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      description: w.description || "",
      trigger_field: w.trigger_field,
      trigger_value: w.trigger_value || "",
      action_type: w.action_type,
      action_config: JSON.stringify(w.action_config, null, 2),
      is_active: w.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(form.action_config || "{}");
    } catch {
      toast.error("Invalid JSON in action config"); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      trigger_field: form.trigger_field,
      trigger_value: form.trigger_value.trim() || null,
      action_type: form.action_type,
      action_config: parsedConfig as any,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase.from("chat_workflows").update(payload as any).eq("id", editingId);
      if (error) { toast.error("Failed to update workflow"); } else { toast.success("Workflow updated"); }
    } else {
      const { error } = await supabase.from("chat_workflows").insert(payload as any);
      if (error) { toast.error("Failed to create workflow"); } else { toast.success("Workflow created"); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchWorkflows();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("chat_workflows").delete().eq("id", deleteId);
    if (error) { toast.error("Failed to delete workflow"); } else { toast.success("Workflow deleted"); }
    setDeleteId(null);
    fetchWorkflows();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("chat_workflows").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error("Failed to toggle"); } else {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w));
    }
  };

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Workflow Rules</CardTitle>
              <CardDescription className="text-xs mt-0.5">Manage automated workflows and rules created by AI or manually</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Workflow
            </Button>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Workflow className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No workflows found</p>
              <p className="text-xs mt-1">Create your first workflow or use AI chatbot to generate them.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(w => (
                <div key={w.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{w.name}</span>
                      <Badge variant={w.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {w.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {w.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span>Trigger: <span className="font-medium text-foreground">{TRIGGER_FIELDS.find(t => t.value === w.trigger_field)?.label || w.trigger_field}</span></span>
                      {w.trigger_value && <span>= <span className="font-medium text-foreground">{w.trigger_value}</span></span>}
                      <span>→ <span className="font-medium text-foreground">{ACTION_TYPES.find(a => a.value === w.action_type)?.label || w.action_type}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActive(w.id, w.is_active)}>
                      <ToggleLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(w)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(w.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {format(new Date(w.created_at), "dd MMM, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Auto-assign on state change" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this workflow do?" rows={2} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Trigger Field</Label>
                <Select value={form.trigger_field} onValueChange={v => setForm(f => ({ ...f, trigger_field: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_FIELDS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Trigger Value</Label>
                <Input value={form.trigger_value} onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))} placeholder="e.g. live" className="h-9 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Action Type</Label>
              <Select value={form.action_type} onValueChange={v => setForm(f => ({ ...f, action_type: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Action Config (JSON)</Label>
              <Textarea value={form.action_config} onChange={e => setForm(f => ({ ...f, action_config: e.target.value }))} rows={4} className="font-mono text-xs" placeholder='{"owner_email": "user@example.com"}' />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The workflow will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
