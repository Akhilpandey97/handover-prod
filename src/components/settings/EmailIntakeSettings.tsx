import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Save, RefreshCw, Inbox, Users, Loader2 } from "lucide-react";

/** app_settings keys that drive the Gmail handover parser (per tenant). */
const KEYS = {
  monitor: "email_monitor_address",
  keywords: "email_subject_keywords",
  brandRegex: "email_brand_regex",
  lookbackDays: "email_lookback_days",
  autoCreate: "email_auto_create_project",
  assignMode: "email_assignment_mode",
  assignPool: "email_assignment_pool",
  rrIndex: "email_assignment_rr_index",
} as const;

const DEFAULTS: Record<string, string> = {
  [KEYS.monitor]: "any",
  [KEYS.keywords]: "New Brand On Board, Sales to MINT Handover for Scoping",
  [KEYS.brandRegex]:
    "Sales to MINT Handover for Scoping\\s*[-–—]\\s*(.+?)\\s*[-–—]\\s*Storefront\nNew Brand On Board\\s*[-–—]\\s*(.+)",
  [KEYS.lookbackDays]: "30",
  [KEYS.autoCreate]: "true",
  [KEYS.assignMode]: "none",
  [KEYS.assignPool]: "",
};

interface Member {
  id: string;
  name: string;
  email: string;
}

export const EmailIntakeSettings = () => {
  const { currentUser } = useAuth();
  const [values, setValues] = useState<Record<string, string>>(DEFAULTS);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);

  const tenantId = currentUser?.tenantId || null;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: settings }, { data: profiles }] = await Promise.all([
        supabase.from("app_settings").select("key, value").eq("tenant_id", tenantId as string),
        supabase.from("profiles").select("id, name, email").eq("tenant_id", tenantId as string).order("name"),
      ]);
      const merged = { ...DEFAULTS };
      (settings || []).forEach((row: { key: string; value: string }) => {
        if (Object.values(KEYS).includes(row.key as never)) merged[row.key] = row.value;
      });
      setValues(merged);
      setMembers((profiles || []) as Member[]);
      setLoading(false);
    };
    if (tenantId) void load();
    else setLoading(false);
  }, [tenantId]);

  const get = (key: string) => draft[key] ?? values[key] ?? "";
  const set = (key: string, value: string) => setDraft((p) => ({ ...p, [key]: value }));
  const hasChanges = Object.keys(draft).length > 0;

  const pool = useMemo(
    () => get(KEYS.assignPool).split(",").map((s) => s.trim()).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, values],
  );

  const togglePool = (userId: string) => {
    const next = pool.includes(userId) ? pool.filter((id) => id !== userId) : [...pool, userId];
    set(KEYS.assignPool, next.join(","));
  };

  const save = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(draft).map(([key, value]) => ({
        key,
        value,
        category: "email",
        tenant_id: tenantId,
      }));
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key,tenant_id" });
      if (error) throw error;
      setValues((p) => ({ ...p, ...draft }));
      setDraft({});
      toast.success("Email intake rules saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("poll-emails", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success(data?.message || "Mailbox scanned");
    } catch (e: any) {
      toast.error(e.message || "Mailbox scan failed");
    } finally {
      setPolling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading email rules…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            <strong>{Object.keys(draft).length}</strong> unsaved change(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft({})}>Revert</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save rules"}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" />Mailbox connection</CardTitle>
          <CardDescription>
            Your workspace reads handover emails from one shared mailbox — individual users never connect their own
            Gmail. An admin authorises the mailbox once (Google client ID, secret and refresh token stored as
            workspace secrets), and every parsed email lands in the Emails tab for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1.5"><Mail className="h-3 w-3" />Shared workspace mailbox</Badge>
          <Button variant="outline" size="sm" onClick={runNow} disabled={polling}>
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Scanning…" : "Scan mailbox now"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Credentials are managed under Settings → Secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Matching rules</CardTitle>
          <CardDescription>Decide which emails are treated as a handover and how the brand name is read.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sender filter</Label>
              <Input
                value={get(KEYS.monitor)}
                onChange={(e) => set(KEYS.monitor, e.target.value)}
                placeholder="sales@yourcompany.com or 'any'"
              />
              <p className="text-[11px] text-muted-foreground">Use <code>any</code> to accept every sender.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Look-back window (days)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={get(KEYS.lookbackDays)}
                onChange={(e) => set(KEYS.lookbackDays, e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subject keywords (comma separated)</Label>
            <Textarea
              rows={2}
              value={get(KEYS.keywords)}
              onChange={(e) => set(KEYS.keywords, e.target.value)}
              placeholder="New Brand On Board, Sales to MINT Handover for Scoping"
            />
            <p className="text-[11px] text-muted-foreground">
              Multi-word phrases are quoted automatically and matched case-insensitively.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Brand extraction patterns (one regex per line)</Label>
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={get(KEYS.brandRegex)}
              onChange={(e) => set(KEYS.brandRegex, e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              The first capture group becomes the merchant name. Patterns are tried top to bottom, e.g.{" "}
              <code>Sales to MINT Handover for Scoping – Brand – Storefront</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Auto-creation & assignment</CardTitle>
          <CardDescription>Control whether matched emails become projects and who picks them up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Auto-create project from matched email</p>
              <p className="text-xs text-muted-foreground">
                When off, emails only appear in the Emails tab for manual mapping.
              </p>
            </div>
            <Switch
              checked={get(KEYS.autoCreate) === "true"}
              onCheckedChange={(v) => set(KEYS.autoCreate, String(v))}
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assignment mode</Label>
              <Select value={get(KEYS.assignMode)} onValueChange={(v) => set(KEYS.assignMode, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Leave unassigned</SelectItem>
                  <SelectItem value="round_robin">Round-robin across pool</SelectItem>
                  <SelectItem value="fixed">Always the first person in pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pool size</Label>
              <Input readOnly value={`${pool.length} member(s) selected`} className="bg-muted/40" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Assignment pool</Label>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => {
                const active = pool.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePool(m.id)}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition ${
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                    </div>
                    {active && <Badge variant="secondary" className="text-[10px]">In pool</Badge>}
                  </button>
                );
              })}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">No workspace members found.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!hasChanges || saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </div>
  );
};

export default EmailIntakeSettings;
