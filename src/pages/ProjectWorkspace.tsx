import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoginScreen } from "@/components/LoginScreen";
import { AssignOwnerDialog } from "@/components/AssignOwnerDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { TransferDialog } from "@/components/TransferDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { useProjects } from "@/contexts/ProjectContext";
import {
  Project,
  ProjectChecklist,
  ProjectState,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateLabels,
} from "@/data/projectsData";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  FileStack,
  Files,
  Filter,
  FolderKanban,
  LayoutGrid,
  ListFilter,
  MessageSquareText,
  NotebookPen,
  PanelLeftClose,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

type WorkspaceTab = "overview" | "activity" | "tasks" | "notes" | "files";
type ProjectListFilter = "all" | "active" | "blocked" | "live";
type ActivityKind = "user" | "system" | "handoff" | "milestone";

interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  actor: string;
  source: string;
  timestamp: number;
  timestampLabel: string;
  dateLabel: string;
}

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "tasks", label: "Tasks" },
  { value: "notes", label: "Notes" },
  { value: "files", label: "Files" },
];

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: FolderKanban, label: "Projects", href: "/" },
  { icon: CheckCheck, label: "Tasks", href: "/" },
  { icon: Files, label: "Files", href: "/" },
  { icon: Settings2, label: "Settings", href: "/" },
];

const stateToneMap: Record<ProjectState, string> = {
  not_started: "bg-slate-100 text-slate-700 border-slate-200",
  on_hold: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  live: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
};

const activityToneMap: Record<ActivityKind, string> = {
  user: "bg-emerald-500",
  system: "bg-slate-500",
  handoff: "bg-blue-500",
  milestone: "bg-amber-500",
};

const activityBadgeToneMap: Record<ActivityKind, string> = {
  user: "bg-emerald-50 text-emerald-700 border-emerald-200",
  system: "bg-slate-100 text-slate-700 border-slate-200",
  handoff: "bg-blue-50 text-blue-700 border-blue-200",
  milestone: "bg-amber-50 text-amber-700 border-amber-200",
};

const formatDateTime = (value?: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    timestamp: date.getTime(),
    timestampLabel: new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
    dateLabel: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
  };
};

const buildActivityFeed = (project: Project): ActivityEntry[] => {
  const items: ActivityEntry[] = [];

  const pushEvent = (
    id: string,
    kind: ActivityKind,
    title: string,
    description: string,
    actor: string,
    source: string,
    date?: string,
  ) => {
    const parsed = formatDateTime(date);
    if (!parsed) return;

    items.push({
      id,
      kind,
      title,
      description,
      actor,
      source,
      timestamp: parsed.timestamp,
      timestampLabel: parsed.timestampLabel,
      dateLabel: parsed.dateLabel,
    });
  };

  pushEvent(
    `${project.id}-kickoff`,
    "milestone",
    "Kickoff scheduled",
    `Project workspace opened for ${project.merchantName}.`,
    "System",
    "Project milestone",
    project.dates.kickOffDate,
  );

  pushEvent(
    `${project.id}-target`,
    "milestone",
    "Target go-live date updated",
    `Expected go-live is ${project.dates.expectedGoLiveDate || "not set yet"}.`,
    "System",
    "Project milestone",
    project.dates.expectedGoLiveDate,
  );

  pushEvent(
    `${project.id}-live`,
    "milestone",
    "Project marked live",
    "Merchant went live successfully.",
    "System",
    "Lifecycle milestone",
    project.dates.goLiveDate,
  );

  project.transferHistory.forEach((transfer) => {
    pushEvent(
      `transfer-${transfer.id}`,
      "handoff",
      `Transferred from ${transfer.fromTeam} to ${transfer.toTeam}`,
      transfer.notes || "Project ownership moved to the next team.",
      transfer.transferredBy || "System",
      "Team handoff",
      transfer.transferredAt,
    );

    pushEvent(
      `accept-${transfer.id}`,
      "user",
      `Transfer accepted by ${transfer.acceptedBy || transfer.toTeam}`,
      `Project is now active with ${transfer.toTeam}.`,
      transfer.acceptedBy || "System",
      "Team handoff",
      transfer.acceptedAt,
    );
  });

  project.responsibilityLog.forEach((entry) => {
    pushEvent(
      `project-responsibility-${entry.id}`,
      "system",
      `${entry.party} responsibility started`,
      `Execution moved into the ${entry.phase} phase.`,
      "System",
      "Responsibility",
      entry.startedAt,
    );
  });

  project.checklist.forEach((item) => {
    pushEvent(
      `checklist-done-${item.id}`,
      "user",
      `${item.title} completed`,
      `Responsibility at completion: ${item.currentResponsibility}.`,
      item.completedBy || "User",
      `${item.ownerTeam} checklist`,
      item.completedAt,
    );

    pushEvent(
      `checklist-comment-${item.id}`,
      "system",
      `Note added on ${item.title}`,
      item.comment || "Inline task note captured.",
      item.commentBy || "System",
      `${item.ownerTeam} checklist`,
      item.commentAt,
    );
  });

  return items.sort((a, b) => b.timestamp - a.timestamp);
};

const groupByDate = (items: ActivityEntry[]) =>
  items.reduce(
    (acc, item) => {
      const list = acc[item.dateLabel] || [];
      list.push(item);
      acc[item.dateLabel] = list;
      return acc;
    },
    {} as Record<string, ActivityEntry[]>,
  );

const getRiskLevel = (project: Project) => {
  if (project.projectState === "blocked" || project.pendingAcceptance) {
    return { label: "High risk", tone: "bg-rose-100 text-rose-800 border-rose-200" };
  }

  if (project.projectState === "on_hold" || project.goLivePercent < 40) {
    return { label: "Medium risk", tone: "bg-amber-100 text-amber-800 border-amber-200" };
  }

  return { label: "Low risk", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
};

const getLastUpdated = (project: Project) => {
  const candidateDates = [
    project.dates.goLiveDate,
    project.dates.expectedGoLiveDate,
    ...project.transferHistory.map((entry) => entry.acceptedAt || entry.transferredAt),
    ...project.responsibilityLog.map((entry) => entry.startedAt),
    ...project.checklist.flatMap((item) => [item.completedAt, item.commentAt]),
  ].filter(Boolean) as string[];

  const latest = candidateDates
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

  if (!latest) return "No recent updates";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(latest));
};

const buildNextActions = (project: Project, canTransfer: boolean, isTransferReady: boolean) => {
  const openChecklist = project.checklist.filter((item) => !item.completed);
  const currentTeamOpen = openChecklist.filter((item) => item.ownerTeam === project.currentOwnerTeam).slice(0, 2);
  const actions = [
    currentTeamOpen.length > 0
      ? `Close ${currentTeamOpen.map((item) => item.title).join(" and ")} for the ${project.currentOwnerTeam} team.`
      : null,
    !project.assignedOwnerName ? "Assign a named owner so handoffs and follow-ups have clear accountability." : null,
    !project.links.jiraLink ? "Attach the JIRA tracker so delivery, notes, and escalation context stay in one workflow." : null,
    canTransfer && !isTransferReady ? "Finish all current-team checklist items before transfer can be triggered." : null,
    canTransfer && isTransferReady ? "Transfer is ready. Review summary context, then move the project to the next team." : null,
  ].filter(Boolean) as string[];

  return actions.slice(0, 4);
};

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const {
    projects,
    updateProject,
    deleteProject,
    transferProject,
    updateChecklist,
    updateChecklistComment,
  } = useProjects();
  const { teamLabels, stateLabels, phaseLabels, responsibilityLabels } = useLabels();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<ProjectListFilter>("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const project = projects.find((entry) => entry.id === projectId) ?? null;

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects
      .filter((entry) => {
        if (listFilter === "active") return entry.projectState === "in_progress" || entry.projectState === "not_started";
        if (listFilter === "blocked") return entry.projectState === "blocked" || entry.projectState === "on_hold";
        if (listFilter === "live") return entry.projectState === "live";
        return true;
      })
      .filter((entry) => {
        if (!query) return true;
        return (
          entry.merchantName.toLowerCase().includes(query) ||
          entry.mid.toLowerCase().includes(query) ||
          (entry.assignedOwnerName || "").toLowerCase().includes(query)
        );
      });
  }, [listFilter, projects, searchQuery]);

  const groupedChecklist = useMemo(() => {
    if (!project) return [] as Array<{ team: string; items: ProjectChecklist[] }>;

    const groups = project.checklist.reduce(
      (acc, item) => {
        const list = acc[item.ownerTeam] || [];
        list.push(item);
        acc[item.ownerTeam] = list;
        return acc;
      },
      {} as Record<string, ProjectChecklist[]>,
    );

    return Object.entries(groups).map(([team, items]) => ({ team, items }));
  }, [project]);

  const activityFeed = useMemo(() => (project ? buildActivityFeed(project) : []), [project]);
  const groupedActivity = useMemo(() => groupByDate(activityFeed), [activityFeed]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              This project could not be found in your current workspace.
            </p>
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedChecklist = project.checklist.filter((item) => item.completed).length;
  const pendingOn = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);
  const currentTeamChecklist = project.checklist.filter((item) => item.ownerTeam === project.currentOwnerTeam);
  const allCurrentTeamChecklistCompleted =
    currentTeamChecklist.length > 0 && currentTeamChecklist.every((item) => item.completed);
  const canTransfer =
    currentUser?.team === project.currentOwnerTeam &&
    !project.pendingAcceptance &&
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";
  const isTransferReady = canTransfer && allCurrentTeamChecklistCompleted;
  const risk = getRiskLevel(project);
  const nextActions = buildNextActions(project, canTransfer, isTransferReady);

  const overviewStats = [
    {
      label: "Owner",
      value: project.assignedOwnerName || "Unassigned",
      icon: UserRound,
    },
    {
      label: "Phase",
      value: phaseLabels[project.currentPhase] || project.currentPhase,
      icon: CircleDashed,
    },
    {
      label: "Risk",
      value: risk.label,
      icon: ShieldAlert,
    },
    {
      label: "Last Update",
      value: getLastUpdated(project),
      icon: Clock3,
    },
  ];

  const projectDetails = [
    ["MID", project.mid],
    ["Platform", project.platform],
    ["Category", project.category || "—"],
    ["ARR", `${project.arr} Cr`],
    ["Txn / day", `${project.txnsPerDay}`],
    ["AOV", `₹${project.aov.toLocaleString()}`],
    ["Sales SPOC", project.salesSpoc || "—"],
    ["Integration", project.integrationType || "—"],
    ["PG onboarding", project.pgOnboarding || "—"],
    ["Kick-off", project.dates.kickOffDate || "—"],
    ["Expected go-live", project.dates.expectedGoLiveDate || "—"],
    ["Responsibility", responsibilityLabels[pendingOn] || pendingOn],
  ];

  const quickLinks = [
    project.links.brandUrl ? { label: "Website", href: project.links.brandUrl } : null,
    project.links.jiraLink ? { label: "JIRA", href: project.links.jiraLink } : null,
    project.links.brdLink ? { label: "BRD", href: project.links.brdLink } : null,
    project.links.mintChecklistLink ? { label: "MINT Checklist", href: project.links.mintChecklistLink } : null,
    project.links.integrationChecklistLink
      ? { label: "Integration Checklist", href: project.links.integrationChecklistLink }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  const handleSaveEdit = (updatedProject: Project) => {
    updateProject(updatedProject);
    toast.success("Project updated successfully");
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setDeleteConfirmOpen(false);
    toast.success("Project deleted");
  };

  const handleTransfer = (assigneeId: string, assigneeName: string, notes: string) => {
    const nextTeamKey = project.currentOwnerTeam === "mint" ? "integration" : "ms";
    const nextTeam = teamLabels[nextTeamKey] || nextTeamKey;
    const transferNote = notes || `Transferred to ${nextTeam} team`;
    transferProject(project.id, `${transferNote} (Assigned to: ${assigneeName})`, assigneeId);
    toast.success(`Transferred ${project.merchantName} to ${assigneeName}`);
  };

  const handleTaskCommentSave = (item: ProjectChecklist) => {
    const nextComment = taskDrafts[item.id] ?? item.comment ?? "";
    updateChecklistComment(project.id, item.id, nextComment);
    setEditingTaskId(null);
    toast.success("Task note updated");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1800px] px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid gap-4 lg:grid-cols-[84px_360px_minmax(0,1fr)]">
          <aside className="enterprise-panel sticky top-4 flex h-[calc(100vh-2rem)] flex-col items-center rounded-[28px] px-3 py-4">
            <Button asChild variant="ghost" size="icon" className="mb-3 rounded-2xl">
              <Link to="/" aria-label="Back to dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <PanelLeftClose className="h-5 w-5" />
            </div>

            <nav className="flex flex-1 flex-col items-center gap-2">
              {navItems.map((item, index) => (
                <Button
                  key={item.label}
                  asChild
                  variant={index === 1 ? "default" : "ghost"}
                  size="icon"
                  className="rounded-2xl"
                >
                  <Link to={item.href} aria-label={item.label}>
                    <item.icon className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </nav>

            <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 px-2 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">CRM</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{filteredProjects.length}</p>
            </div>
          </aside>

          <section className="enterprise-panel min-h-[calc(100vh-2rem)] rounded-[32px] p-4 lg:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Project Navigator
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-foreground">Pipeline</h2>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {filteredProjects.length} records
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search project, MID, owner"
                  className="h-11 rounded-2xl border-border/70 bg-background/70 pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "All"],
                  ["active", "Active"],
                  ["blocked", "Blocked"],
                  ["live", "Live"],
                ] as Array<[ProjectListFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setListFilter(value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                      listFilter === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-card/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-y border-border/60 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Smart filters</p>
                <p className="text-sm text-foreground">Search, status tags, and owner visibility</p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <ListFilter className="h-4 w-4" />
                Filters
              </Button>
            </div>

            <ScrollArea className="mt-4 h-[calc(100vh-18rem)] pr-2">
              <div className="space-y-3">
                {filteredProjects.map((entry) => {
                  const isSelected = entry.id === project.id;
                  const entryCompleted = entry.checklist.filter((item) => item.completed).length;
                  return (
                    <Link
                      key={entry.id}
                      to={`/projects/${entry.id}`}
                      className={cn(
                        "block rounded-[24px] border p-4 transition-all",
                        isSelected
                          ? "border-primary/30 bg-primary/5 shadow-[0_20px_45px_-30px_hsl(var(--primary)/0.55)]"
                          : "border-border/70 bg-card/70 hover:border-primary/20 hover:bg-card",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                              {entry.merchantName.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{entry.merchantName}</p>
                              <p className="truncate text-xs text-muted-foreground">MID {entry.mid}</p>
                            </div>
                          </div>
                        </div>

                        <Badge
                          className={cn(
                            "border px-2.5 py-1 text-[10px] font-semibold",
                            stateToneMap[entry.projectState],
                          )}
                        >
                          {stateLabels[entry.projectState] || projectStateLabels[entry.projectState]}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline">{teamLabels[entry.currentOwnerTeam] || entry.currentOwnerTeam}</Badge>
                        <Badge variant="outline">{phaseLabels[entry.currentPhase] || entry.currentPhase}</Badge>
                        <Badge variant="secondary">{entryCompleted}/{entry.checklist.length} tasks</Badge>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <span>Progress</span>
                          <span>{entry.goLivePercent}%</span>
                        </div>
                        <Progress value={entry.goLivePercent} className="h-2.5 rounded-full bg-secondary" />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{entry.assignedOwnerName || "No owner"}</span>
                        <span>{phaseLabels[entry.currentPhase] || entry.currentPhase}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ScrollArea>
          </section>

          <section className="enterprise-panel min-h-[calc(100vh-2rem)] rounded-[34px] p-4 lg:p-5">
            <div className="grid gap-4">
              <header className="rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--card)/0.92)_60%,hsl(var(--primary)/0.06)_100%)] p-5 shadow-[0_24px_60px_-36px_hsl(var(--foreground)/0.35)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
                        {project.merchantName}
                      </h1>
                      <Badge className={cn("border px-3 py-1.5 text-xs font-semibold", stateToneMap[project.projectState])}>
                        {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">MID {project.mid}</Badge>
                      <Badge variant="outline">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
                      <Badge variant="outline">{phaseLabels[project.currentPhase] || project.currentPhase}</Badge>
                      {project.pendingAcceptance ? <Badge className="border border-amber-200 bg-amber-100 text-amber-800">Pending acceptance</Badge> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {currentUser?.team === "manager" ? (
                      <Button variant="outline" className="rounded-2xl" onClick={() => setAssignOpen(true)}>
                        <UserRound className="h-4 w-4" />
                        Assign Owner
                      </Button>
                    ) : null}
                    <Button variant="outline" className="rounded-2xl" onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                    <Button
                      className="rounded-2xl"
                      onClick={() => isTransferReady && setTransferOpen(true)}
                      disabled={!isTransferReady}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Transfer
                    </Button>
                    {currentUser?.team === "manager" ? (
                      <Button variant="destructive" className="rounded-2xl" onClick={() => setDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
                  <div className="rounded-[24px] border border-primary/15 bg-primary/[0.06] p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AI Summary</p>
                        <p className="text-sm text-muted-foreground">Operational readout for the next team move</p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-foreground">
                      {project.merchantName} is in{" "}
                      <span className="font-semibold">{phaseLabels[project.currentPhase] || project.currentPhase}</span>
                      {" "}with{" "}
                      <span className="font-semibold">
                        {completedChecklist}/{project.checklist.length}
                      </span>{" "}
                      checklist items closed. Current responsibility sits with{" "}
                      <span className="font-semibold">{responsibilityLabels[pendingOn] || pendingOn}</span>, and the project is{" "}
                      <span className="font-semibold">
                        {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                      </span>.
                    </p>

                    <div className="mt-4 grid gap-2">
                      {nextActions.length > 0 ? (
                        nextActions.map((action) => (
                          <div
                            key={action}
                            className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/85 px-3 py-3"
                          >
                            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                            <span className="text-sm leading-6 text-foreground">{action}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-border/70 bg-card/85 px-3 py-3 text-sm text-muted-foreground">
                          No immediate action is blocking progress.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    {overviewStats.map((stat) => (
                      <div key={stat.label} className="rounded-[22px] border border-border/70 bg-card/80 px-4 py-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <stat.icon className="h-3.5 w-3.5" />
                          {stat.label}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </header>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)}>
                <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-[22px] border border-border/70 bg-card/70 p-1">
                  {tabOptions.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-2xl px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project details</p>
                          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Core operating data</h3>
                        </div>
                        <Badge variant="secondary">Data-dense overview</Badge>
                      </div>

                      <div className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                        {projectDetails.map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checklist progress</p>
                            <h3 className="mt-1 text-lg font-semibold text-foreground">{completedChecklist}/{project.checklist.length} complete</h3>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                        <Progress
                          value={project.checklist.length ? (completedChecklist / project.checklist.length) * 100 : 0}
                          className="mt-4 h-2.5 rounded-full bg-secondary"
                        />

                        <div className="mt-4 space-y-3">
                          {groupedChecklist.map(({ team, items }) => {
                            const done = items.filter((item) => item.completed).length;
                            return (
                              <div key={team} className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{teamLabels[team] || team}</p>
                                    <p className="text-xs text-muted-foreground">{done} of {items.length} closed</p>
                                  </div>
                                  <Badge variant="outline">{done}/{items.length}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick links</p>
                            <h3 className="mt-1 text-lg font-semibold text-foreground">Jump to working context</h3>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-primary" />
                        </div>

                        <div className="mt-4 space-y-3">
                          {quickLinks.length > 0 ? (
                            quickLinks.map((link) => (
                              <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/25 hover:text-primary"
                              >
                                <span>{link.label}</span>
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground">
                              No linked documents or external tools attached yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Activity timeline</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Grouped by date</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="border border-slate-200 bg-slate-100 text-slate-700">{activityFeed.length} events</Badge>
                        <Badge className="border border-blue-200 bg-blue-50 text-blue-700">Color-coded types</Badge>
                      </div>
                    </div>

                    <div className="mt-5 space-y-6">
                      {Object.entries(groupedActivity).map(([dateLabel, items]) => (
                        <div key={dateLabel}>
                          <div className="mb-3 flex items-center gap-3">
                            <div className="h-px flex-1 bg-border/70" />
                            <Badge variant="outline" className="px-3 py-1">
                              {dateLabel}
                            </Badge>
                            <div className="h-px flex-1 bg-border/70" />
                          </div>

                          <div className="space-y-3">
                            {items.map((item) => (
                              <div key={item.id} className="grid gap-3 rounded-[24px] border border-border/70 bg-background/75 p-4 md:grid-cols-[20px_minmax(0,1fr)_140px] md:items-start">
                                <div className="flex justify-center pt-1">
                                  <span className={cn("mt-1 h-3.5 w-3.5 rounded-full", activityToneMap[item.kind])} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", activityBadgeToneMap[item.kind])}>
                                      {item.kind}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                                    {item.source} · {item.actor}
                                  </p>
                                </div>
                                <div className="text-left md:text-right">
                                  <p className="text-sm font-semibold text-foreground">{item.timestampLabel}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {activityFeed.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-border bg-background/60 px-4 py-8 text-center">
                          <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="mt-3 text-sm font-semibold text-foreground">No activity captured yet</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Handoffs, checklist updates, notes, and milestones will appear here.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tasks</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Checklist with inline editing</h3>
                      </div>
                      <Badge variant="secondary">{completedChecklist}/{project.checklist.length} complete</Badge>
                    </div>

                    <div className="mt-5 space-y-3">
                      {project.checklist.map((item) => {
                        const isEditing = editingTaskId === item.id;
                        const noteValue = taskDrafts[item.id] ?? item.comment ?? "";

                        return (
                          <div key={item.id} className="rounded-[24px] border border-border/70 bg-background/75 p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="flex min-w-0 gap-3">
                                <Checkbox
                                  checked={item.completed}
                                  onCheckedChange={(checked) => updateChecklist(project.id, item.id, Boolean(checked))}
                                  className="mt-1 h-5 w-5 rounded-md border-border"
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className={cn("text-sm font-semibold text-foreground", item.completed && "text-muted-foreground line-through")}>
                                      {item.title}
                                    </p>
                                    <Badge variant="outline">{teamLabels[item.ownerTeam] || item.ownerTeam}</Badge>
                                    <Badge variant="outline">{phaseLabels[item.phase] || item.phase}</Badge>
                                    <Badge
                                      className={cn(
                                        "border px-2.5 py-1 text-[10px] font-semibold",
                                        item.completed
                                          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                          : "border-slate-200 bg-slate-100 text-slate-700",
                                      )}
                                    >
                                      {item.completed ? "Done" : "Open"}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Responsibility: {responsibilityLabels[item.currentResponsibility] || item.currentResponsibility}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => {
                                    setEditingTaskId(isEditing ? null : item.id);
                                    setTaskDrafts((current) => ({
                                      ...current,
                                      [item.id]: current[item.id] ?? item.comment ?? "",
                                    }));
                                  }}
                                >
                                  <NotebookPen className="h-4 w-4" />
                                  {isEditing ? "Close" : "Edit note"}
                                </Button>
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-card/70 p-3">
                                <Textarea
                                  value={noteValue}
                                  onChange={(event) =>
                                    setTaskDrafts((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Add working notes, blockers, or context for the next owner"
                                  className="min-h-[96px] rounded-2xl border-border/70 bg-background/80"
                                />
                                <div className="mt-3 flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setEditingTaskId(null)}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" className="rounded-xl" onClick={() => handleTaskCommentSave(item)}>
                                    Save note
                                  </Button>
                                </div>
                              </div>
                            ) : item.comment ? (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest note</p>
                                <p className="mt-2 text-sm leading-6 text-foreground">{item.comment}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Current Phase", project.notes.currentPhaseComment || "No current phase note added."],
                      ["Project Notes", project.notes.projectNotes || "No project notes added."],
                      ["Pre-sales Notes", project.notes.mintNotes || "No pre-sales note added."],
                      ["Phase 2 Notes", project.notes.phase2Comment || "No phase 2 note added."],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                        <p className="mt-4 text-sm leading-7 text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-4">
                  <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Files</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Attached workspace assets</h3>
                      </div>
                      <FileStack className="h-5 w-5 text-primary" />
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {quickLinks.length > 0 ? (
                        quickLinks.map((link) => (
                          <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[24px] border border-border/70 bg-background/75 p-4 transition hover:border-primary/25"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Files className="h-4 w-4" />
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="mt-4 text-sm font-semibold text-foreground">{link.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Open linked project artifact</p>
                          </a>
                        ))
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                          No files are linked to this project yet.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid gap-4 xl:grid-cols-4">
                {[
                  { label: "Checklist", value: `${completedChecklist}/${project.checklist.length}`, icon: CheckCheck },
                  { label: "Internal Time", value: formatDuration(timeByParty.gokwik), icon: CalendarClock },
                  { label: "Merchant Time", value: formatDuration(timeByParty.merchant), icon: Clock3 },
                  { label: "Risk", value: risk.label, icon: AlertTriangle },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-border/70 bg-card/80 px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onSave={handleSaveEdit} />
      <AssignOwnerDialog project={project} open={assignOpen} onOpenChange={setAssignOpen} />
      <TransferDialog
        project={project}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onTransfer={handleTransfer}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{project.merchantName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectWorkspace;
