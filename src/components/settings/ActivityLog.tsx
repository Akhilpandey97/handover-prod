import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Search, Activity, UserCheck, Settings2, Workflow, FileEdit, Trash2, Bot, CheckCircle2, XCircle, Globe } from "lucide-react";
import { format } from "date-fns";

interface ActivityLogEntry {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  assign_owner: <UserCheck className="h-4 w-4" />,
  update_project: <FileEdit className="h-4 w-4" />,
  create_workflow: <Workflow className="h-4 w-4" />,
  delete_workflow: <Trash2 className="h-4 w-4" />,
  workflow_assign_owner: <UserCheck className="h-4 w-4" />,
  workflow_update_field: <Settings2 className="h-4 w-4" />,
  workflow_notify: <Activity className="h-4 w-4" />,
  workflow_log: <Activity className="h-4 w-4" />,
  workflow_comment_created: <FileEdit className="h-4 w-4" />,
  workflow_checklist_item_created: <Workflow className="h-4 w-4" />,
  workflow_error: <Trash2 className="h-4 w-4" />,
  default: <Activity className="h-4 w-4" />,
};

const actionLabels: Record<string, string> = {
  assign_owner: "Owner Assigned",
  update_project: "Project Updated",
  create_workflow: "Workflow Created",
  delete_workflow: "Workflow Deleted",
  workflow_assign_owner: "Workflow Assigned Owner",
  workflow_update_field: "Workflow Updated Project",
  workflow_notify: "Workflow Notification",
  workflow_log: "Workflow Log Entry",
  workflow_comment_created: "Workflow Comment Created",
  workflow_checklist_item_created: "Workflow Checklist Item Created",
  workflow_error: "Workflow Error",
  create_project: "Project Created",
  delete_project: "Project Deleted",
  transfer_project: "Project Transferred",
  update_checklist: "Checklist Updated",
  login: "User Login",
  logout: "User Logout",
};

export const ActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "user" | "system" | "ai">("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setLogs(data as unknown as ActivityLogEntry[]);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const getSource = (log: ActivityLogEntry): "user" | "system" | "ai" => {
    if (log.action.startsWith("workflow_")) return "system";
    if (log.user_name === "AI" || log.user_name === "System" || !log.user_name) return "system";
    if (log.action === "ai_chat" || log.entity_type === "ai") return "ai";
    return "user";
  };

  const filtered = logs.filter(log => {
    const matchesSearch = !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    const matchesSource = sourceFilter === "all" || getSource(log) === sourceFilter;
    return matchesSearch && matchesEntity && matchesSource;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type))];
  const formatDetailValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Activity Log</CardTitle>
              <CardDescription className="text-xs mt-0.5">All system, user, and AI actions across your workspace</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">{filtered.length} entries</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <Tabs value={sourceFilter} onValueChange={v => setSourceFilter(v as any)} className="mt-3">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>
            <TabsTrigger value="user" className="text-xs h-7 px-3 gap-1"><UserCheck className="h-3 w-3" />User</TabsTrigger>
            <TabsTrigger value="system" className="text-xs h-7 px-3 gap-1"><Settings2 className="h-3 w-3" />System</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs h-7 px-3 gap-1"><Bot className="h-3 w-3" />AI</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions, names..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {entityTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No activity logs yet</p>
              <p className="text-xs mt-1">Actions taken via AI chatbot and the app will appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(log => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                    {actionIcons[log.action] || actionIcons.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {actionLabels[log.action] || log.action}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {log.entity_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.entity_name && <span className="font-medium text-foreground">{log.entity_name}</span>}
                      {log.entity_name && " · "}
                      by {log.user_name || "System"}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {Object.entries(log.details).map(([k, v]) => `${k}: ${formatDetailValue(v)}`).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {format(new Date(log.created_at), "dd MMM, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
