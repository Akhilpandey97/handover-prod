import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Send, Eye, Trash2, Clock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Schedule {
  id: string;
  name: string;
  timeframe: "daily" | "weekly";
  days: string[];
  time_ist: string;
  recipients: string[];
  subject_prefix: string | null;
  enabled: boolean;
  last_sent_at: string | null;
}

interface Execution {
  id: string;
  schedule_id: string | null;
  status: string;
  recipients: string[] | null;
  email_count: number | null;
  error_message: string | null;
  triggered_at: string;
}

const emptyDraft = {
  name: "Daily Movement Report",
  timeframe: "daily" as "daily" | "weekly",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  time_ist: "09:00",
  recipients: "",
  subject_prefix: "",
  enabled: true,
};

export const MovementReport = () => {
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId ?? null;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<"daily" | "weekly" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from("movement_report_schedules").select("*").order("created_at", { ascending: false }),
      supabase.from("movement_report_executions").select("*").order("triggered_at", { ascending: false }).limit(20),
    ]);
    setSchedules((s as unknown as Schedule[]) || []);
    setExecutions((e as unknown as Execution[]) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      timeframe: s.timeframe,
      days: s.days || [],
      time_ist: s.time_ist,
      recipients: (s.recipients || []).join(", "),
      subject_prefix: s.subject_prefix || "",
      enabled: s.enabled,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const recipients = draft.recipients.split(",").map((r) => r.trim()).filter(Boolean);
    if (!draft.name.trim()) return toast.error("Give the schedule a name");
    if (recipients.length === 0) return toast.error("Add at least one recipient");
    if (draft.days.length === 0) return toast.error("Pick at least one day");

    setIsSaving(true);
    const payload = {
      name: draft.name.trim(),
      timeframe: draft.timeframe,
      days: draft.days,
      time_ist: draft.time_ist,
      recipients,
      subject_prefix: draft.subject_prefix.trim() || null,
      enabled: draft.enabled,
      tenant_id: tenantId,
      created_by: currentUser?.id ?? null,
    };

    const { error } = editingId
      ? await supabase.from("movement_report_schedules").update(payload).eq("id", editingId)
      : await supabase.from("movement_report_schedules").insert(payload);

    setIsSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Schedule updated" : "Schedule created");
    setDialogOpen(false);
    void load();
  };

  const toggleEnabled = async (s: Schedule) => {
    const { error } = await supabase
      .from("movement_report_schedules")
      .update({ enabled: !s.enabled })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("movement_report_schedules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Schedule deleted");
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const sendNow = async (id: string) => {
    setSendingId(id);
    const { data, error } = await supabase.functions.invoke("send-movement-report", {
      body: { schedule_id: id },
    });
    setSendingId(null);
    if (error || (data && data.ok === false)) {
      toast.error(data?.error || error?.message || "Failed to send report");
    } else {
      toast.success("Report sent");
    }
    void load();
  };

  const preview = async (timeframe: "daily" | "weekly") => {
    if (!tenantId) return toast.error("No workspace found for your account");
    setPreviewLoading(timeframe);
    const { data, error } = await supabase.functions.invoke("send-movement-report", {
      body: { preview: true, tenant_id: tenantId, timeframe },
    });
    setPreviewLoading(null);
    if (error || !data?.html) return toast.error(error?.message || data?.error || "Preview failed");
    setPreviewHtml(data.html);
  };

  const toggleDay = (day: string) =>
    setDraft((d) => ({
      ...d,
      days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day],
    }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> AI Movement Reports
            </CardTitle>
            <CardDescription>
              AI-summarised daily and weekly movement across projects — wins, updates, lowlights and blockers,
              emailed to your stakeholders.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => preview("daily")} disabled={previewLoading !== null}>
              {previewLoading === "daily" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview daily
            </Button>
            <Button variant="outline" size="sm" onClick={() => preview("weekly")} disabled={previewLoading !== null}>
              {previewLoading === "weekly" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview weekly
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : schedules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No schedules yet. Create one to start receiving AI movement reports.
            </p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(s)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{s.name}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">{s.timeframe}</Badge>
                      {!s.enabled && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {s.time_ist} IST · {(s.days || []).join(", ")}
                      </span>
                      <span>{(s.recipients || []).length} recipient(s)</span>
                      {s.last_sent_at && <span>Last sent {new Date(s.last_sent_at).toLocaleString()}</span>}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.enabled} onCheckedChange={() => toggleEnabled(s)} />
                    <Button variant="outline" size="sm" onClick={() => sendNow(s.id)} disabled={sendingId === s.id}>
                      {sendingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sends</CardTitle>
          <CardDescription>Last 20 report executions</CardDescription>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No reports have run yet.</p>
          ) : (
            <div className="divide-y divide-border text-sm">
              {executions.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.triggered_at).toLocaleString()}
                    </span>
                    {e.error_message && (
                      <p className="truncate text-xs text-destructive">{e.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{e.email_count ?? 0} emails</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        e.status === "success" && "border-emerald-300 text-emerald-700",
                        e.status === "failed" && "border-destructive text-destructive",
                      )}
                    >
                      {e.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit schedule" : "New movement report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Timeframe</Label>
                <Select
                  value={draft.timeframe}
                  onValueChange={(v) => setDraft({ ...draft, timeframe: v as "daily" | "weekly" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (last 24h)</SelectItem>
                    <SelectItem value="weekly">Weekly (last 7 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Send time (IST)</Label>
                <Input
                  type="time"
                  value={draft.time_ist}
                  onChange={(e) => setDraft({ ...draft, time_ist: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition",
                      draft.days.includes(d)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Recipients (comma separated)</Label>
              <Input
                value={draft.recipients}
                placeholder="ops@company.com, lead@company.com"
                onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject prefix (optional)</Label>
              <Input
                value={draft.subject_prefix}
                placeholder="[Handover]"
                onChange={(e) => setDraft({ ...draft, subject_prefix: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Paused schedules never send automatically.</p>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save changes" : "Create schedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewHtml !== null} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report preview</DialogTitle>
          </DialogHeader>
          <div
            className="rounded-md border border-border bg-white p-2"
            dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MovementReport;
