import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoginScreen } from "@/components/LoginScreen";
import { AssignOwnerDialog } from "@/components/AssignOwnerDialog";
import { ChecklistDialog } from "@/components/ChecklistDialog";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { useProjects } from "@/contexts/ProjectContext";
import {
  Project,
  ProjectState,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateLabels,
} from "@/data/projectsData";
import { fetchAiInsights } from "@/utils/aiInsights";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileStack,
  Files,
  Globe,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

type WorkspaceTab = "overview" | "activity" | "checklists" | "notes" | "files";
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

interface RiskDriver {
  label: string;
  points: number;
}

interface RiskAssessment {
  score: number;
  label: "Low risk" | "Medium risk" | "High risk";
  tone: string;
  drivers: RiskDriver[];
}

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "checklists", label: "Checklists" },
  { value: "notes", label: "Notes" },
  { value: "files", label: "Files" },
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

const getLatestProjectTimestamp = (project: Project) => {
  const candidateDates = [
    project.dates.goLiveDate,
    project.dates.expectedGoLiveDate,
    ...project.transferHistory.map((entry) => entry.acceptedAt || entry.transferredAt),
    ...project.responsibilityLog.map((entry) => entry.startedAt),
    ...project.checklist.flatMap((item) => [item.completedAt, item.commentAt]),
  ].filter(Boolean) as string[];

  return candidateDates
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];
};

const calculateRiskAssessment = (project: Project): RiskAssessment => {
  const drivers: RiskDriver[] = [];
  const now = new Date();
  const checklistTotal = project.checklist.length;
  const checklistDone = project.checklist.filter((item) => item.completed).length;
  const completionRatio = checklistTotal > 0 ? checklistDone / checklistTotal : 0;
  const latestTimestamp = getLatestProjectTimestamp(project);
  const expectedGoLive = project.dates.expectedGoLiveDate ? new Date(project.dates.expectedGoLiveDate) : null;
  const kickOff = project.dates.kickOffDate ? new Date(project.dates.kickOffDate) : null;

  if (project.projectState === "blocked") {
    drivers.push({ label: "Project is blocked", points: 45 });
  }

  if (project.pendingAcceptance) {
    drivers.push({ label: "Pending acceptance from next owner", points: 20 });
  }

  if (project.projectState === "on_hold") {
    drivers.push({ label: "Project is on hold", points: 18 });
  }

  if (!project.assignedOwnerName) {
    drivers.push({ label: "Owner is unassigned", points: 10 });
  }

  if (project.goLivePercent < 25) {
    drivers.push({ label: "Go-live progress is below 25%", points: 12 });
  } else if (project.goLivePercent < 50) {
    drivers.push({ label: "Go-live progress is below 50%", points: 6 });
  }

  if (checklistTotal > 0 && completionRatio < 0.35) {
    drivers.push({ label: "Most checklist items are still open", points: 12 });
  } else if (checklistTotal > 0 && completionRatio < 0.7) {
    drivers.push({ label: "Checklist completion is still moderate", points: 6 });
  }

  if (
    expectedGoLive &&
    !Number.isNaN(expectedGoLive.getTime()) &&
    expectedGoLive.getTime() < now.getTime() &&
    project.projectState !== "live"
  ) {
    drivers.push({ label: "Expected go-live date has passed", points: 20 });
  }

  if (
    kickOff &&
    !Number.isNaN(kickOff.getTime()) &&
    kickOff.getTime() < now.getTime() &&
    project.projectState === "not_started"
  ) {
    drivers.push({ label: "Kick-off date passed but project has not started", points: 14 });
  }

  if (latestTimestamp) {
    const inactiveDays = Math.floor((now.getTime() - latestTimestamp) / (1000 * 60 * 60 * 24));
    if (inactiveDays >= 14) {
      drivers.push({ label: `No meaningful update in ${inactiveDays} days`, points: 14 });
    } else if (inactiveDays >= 7) {
      drivers.push({ label: `No meaningful update in ${inactiveDays} days`, points: 8 });
    }
  }

  if (project.transferHistory.length >= 3) {
    drivers.push({ label: "Multiple ownership handoffs recorded", points: 6 });
  }

  const score = drivers.reduce((sum, driver) => sum + driver.points, 0);

  if (score >= 55) {
    return {
      score,
      label: "High risk",
      tone: "bg-rose-100 text-rose-800 border-rose-200",
      drivers: drivers.sort((a, b) => b.points - a.points),
    };
  }

  if (score >= 28) {
    return {
      score,
      label: "Medium risk",
      tone: "bg-amber-100 text-amber-800 border-amber-200",
      drivers: drivers.sort((a, b) => b.points - a.points),
    };
  }

  return {
    score,
    label: "Low risk",
    tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    drivers:
      drivers.length > 0
        ? drivers.sort((a, b) => b.points - a.points)
        : [{ label: "No major delivery or ownership risks detected", points: 0 }],
  };
};

const getLastUpdated = (project: Project) => {
  const latest = getLatestProjectTimestamp(project);

  if (!latest) return "No recent updates";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(latest));
};

const parseAiBullets = (content: string) =>
  content
    .split("\n")
    .map((line) =>
      line
        .replace(/^[-*•]\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/^Here is the project summary for.*?:/i, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 4);

const buildActionDrivenSummary = (
  project: Project,
  aiBullets: string[],
  risk: RiskAssessment,
  openTasksCount: number,
  completedChecklist: number,
  isTransferReady: boolean,
): Array<{ title: string; body: string; tone: string }> => {
  const nextPending = project.checklist.find((item) => !item.completed);
  const aiSignal = aiBullets[0];

  const cards = [
    {
      title: "Next best action",
      body: isTransferReady
        ? "All current-team checklist items are complete. Review context and transfer ownership to the next team."
        : nextPending
          ? `Prioritize "${nextPending.title}" in ${project.currentOwnerTeam} so the project can move forward.`
          : "No immediate checklist blocker is visible from current project data.",
      tone: "border-primary/20 bg-primary/[0.05]",
    },
    {
      title: "Project status",
      body: `${project.merchantName} is in ${project.currentPhase} and currently marked ${project.projectState.replaceAll("_", " ")} with ${completedChecklist}/${project.checklist.length} checklist items closed.`,
      tone: "border-border/70 bg-background",
    },
    {
      title: "Eye on risk",
      body:
        risk.drivers[0]?.points && risk.drivers[0].points > 0
          ? `${risk.label} (score ${risk.score}). Biggest driver: ${risk.drivers[0].label}.`
          : `${risk.label} (score ${risk.score}). No major execution or ownership risk is currently detected.`,
      tone: "border-border/70 bg-background",
    },
    {
      title: "AI insight",
      body:
        aiSignal ||
        `${openTasksCount} checklist item${openTasksCount === 1 ? "" : "s"} remain open. Review notes, owner handoff readiness, and linked documents before the next update.`,
      tone: "border-border/70 bg-background",
    },
  ];

  return cards;
};

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const {
    projects,
    updateProject,
    deleteProject,
    transferProject,
  } = useProjects();
  const { teamLabels, stateLabels, phaseLabels, responsibilityLabels } = useLabels();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("activity");
  const [editOpen, setEditOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string[]>([]);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const project = projects.find((entry) => entry.id === projectId) ?? null;

  const activityFeed = useMemo(() => (project ? buildActivityFeed(project) : []), [project]);
  const groupedActivity = useMemo(() => groupByDate(activityFeed), [activityFeed]);

  useEffect(() => {
    let ignore = false;

    const loadSummary = async () => {
      if (!project) return;

      setAiSummaryLoading(true);
      setAiSummaryError(null);

      try {
        const result = await fetchAiInsights({ project, type: "summary" });
        if (ignore) return;
        setAiSummary(parseAiBullets(result));
      } catch (error) {
        if (ignore) return;
        setAiSummaryError(error instanceof Error ? error.message : "Unable to generate AI summary.");
        setAiSummary([]);
      } finally {
        if (!ignore) {
          setAiSummaryLoading(false);
        }
      }
    };

    loadSummary();
    return () => {
      ignore = true;
    };
  }, [project]);

  useEffect(() => {
    if (activeTab === "checklists") {
      setChecklistOpen(true);
      setActiveTab("overview");
    }
  }, [activeTab]);

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
  const risk = calculateRiskAssessment(project);
  const openTasksCount = project.checklist.length - completedChecklist;
  const summaryCards = buildActionDrivenSummary(
    project,
    aiSummary,
    risk,
    openTasksCount,
    completedChecklist,
    isTransferReady,
  );

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

  const detailRows = [
    ["Assignee", project.assignedOwnerName || "Unassigned"],
    ["Reporter", project.salesSpoc || currentUser?.name || "—"],
    ["Current team", teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam],
    ["Phase", phaseLabels[project.currentPhase] || project.currentPhase],
    ["Risk", risk.label],
    ["Last update", getLastUpdated(project)],
    ["Responsibility", responsibilityLabels[pendingOn] || pendingOn],
    ["Original estimate", formatDuration(timeByParty.internal + timeByParty.merchant)],
    ["Merchant time", formatDuration(timeByParty.merchant)],
    ["Internal time", formatDuration(timeByParty.internal)],
    ["ARR", `${project.arr} Cr`],
    ["Platform", project.platform],
    ["Expected go-live", project.dates.expectedGoLiveDate || "—"],
  ];

  const noteSections = [
    ["Current phase", project.notes.currentPhaseComment || "No current phase note added."],
    ["Project notes", project.notes.projectNotes || "No project notes added."],
    ["Pre-sales notes", project.notes.mintNotes || "No pre-sales note added."],
    ["Phase 2 notes", project.notes.phase2Comment || "No phase 2 note added."],
  ];

  const quickLinks = [
    project.links.brandUrl ? { label: "Website", href: project.links.brandUrl, icon: Globe } : null,
    project.links.jiraLink ? { label: "JIRA", href: project.links.jiraLink, icon: ArrowUpRight } : null,
    project.links.brdLink ? { label: "BRD", href: project.links.brdLink, icon: FileStack } : null,
    project.links.mintChecklistLink ? { label: "MINT Checklist", href: project.links.mintChecklistLink, icon: CheckCheck } : null,
    project.links.integrationChecklistLink
      ? { label: "Integration Checklist", href: project.links.integrationChecklistLink, icon: CheckCheck }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Globe }>;

  const actionRecommendations = [
    {
      label: "Open checklist",
      sublabel: `${completedChecklist}/${project.checklist.length} items completed`,
      onClick: () => setChecklistOpen(true),
    },
    !project.assignedOwnerName && currentUser?.team === "manager"
      ? { label: "Assign owner", sublabel: "Set clear accountability", onClick: () => setAssignOpen(true) }
      : null,
    project.links.jiraLink
      ? { label: "Open JIRA", sublabel: "Review delivery tracker", href: project.links.jiraLink }
      : { label: "Add tracker link", sublabel: "Attach JIRA or BRD", onClick: () => setEditOpen(true) },
    openTasksCount > 0
      ? {
          label: "Review open checklist",
          sublabel: `${openTasksCount} item${openTasksCount === 1 ? "" : "s"} need attention`,
          onClick: () => setChecklistOpen(true),
        }
      : null,
    risk.label !== "Low risk"
      ? { label: "Inspect activity", sublabel: "Review blockers and handoffs", onClick: () => setActiveTab("activity") }
      : { label: "Update notes", sublabel: "Capture current context", onClick: () => setActiveTab("notes") },
    canTransfer && isTransferReady
      ? { label: "Transfer now", sublabel: "Ownership can move forward", onClick: () => setTransferOpen(true) }
      : null,
  ].filter(Boolean) as Array<
    | { label: string; sublabel: string; onClick: () => void; href?: undefined }
    | { label: string; sublabel: string; href: string; onClick?: undefined }
  >;

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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.28)_100%)]">
      <div className="mx-auto max-w-[1580px] px-4 py-5 lg:px-6 lg:py-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>{project.merchantName}</span>
          </div>

          <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_24px_70px_-45px_hsl(var(--foreground)/0.28)]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 border-b border-border/70 xl:border-b-0 xl:border-r">
                <div className="border-b border-border/70 px-5 py-5 lg:px-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                          {project.merchantName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <span>Project issue</span>
                            <span className="rounded-md bg-secondary px-2 py-1 text-[10px] text-foreground">MID {project.mid}</span>
                          </div>
                          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
                            {project.merchantName}
                          </h1>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge className={cn("border px-2.5 py-1 text-[11px] font-semibold", stateToneMap[project.projectState])}>
                              {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                            </Badge>
                            <Badge variant="outline">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
                            <Badge variant="outline">{phaseLabels[project.currentPhase] || project.currentPhase}</Badge>
                            <Badge variant="outline">{risk.label}</Badge>
                            {project.pendingAcceptance ? (
                              <Badge className="border border-amber-200 bg-amber-100 text-amber-800">Pending acceptance</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4">
                        {[
                          { label: "Owner", value: project.assignedOwnerName || "Unassigned", icon: UserRound },
                          { label: "Phase", value: phaseLabels[project.currentPhase] || project.currentPhase, icon: CheckCircle2 },
                          { label: "Risk", value: risk.label, icon: ShieldAlert },
                          { label: "Last update", value: getLastUpdated(project), icon: Clock3 },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-xl border border-border/70 bg-background px-3 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              <stat.icon className="h-3.5 w-3.5" />
                              {stat.label}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {currentUser?.team === "manager" ? (
                        <Button variant="outline" className="rounded-lg" onClick={() => setAssignOpen(true)}>
                          <UserRound className="h-4 w-4" />
                          Assign owner
                        </Button>
                      ) : null}
                      <Button variant="outline" className="rounded-lg" onClick={() => setEditOpen(true)}>
                        Edit
                      </Button>
                      <Button className="rounded-lg" onClick={() => isTransferReady && setTransferOpen(true)} disabled={!isTransferReady}>
                        <ArrowRight className="h-4 w-4" />
                        Transfer
                      </Button>
                      {currentUser?.team === "manager" ? (
                        <Button variant="destructive" className="rounded-lg" onClick={() => setDeleteConfirmOpen(true)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)}>
                  <div className="border-b border-border/70 px-4 py-3 lg:px-6">
                    <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
                      {tabOptions.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <div className="max-h-[calc(100vh-17rem)] overflow-y-auto px-5 py-5 lg:px-6">
                    <TabsContent value="overview" className="m-0">
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-border/70 bg-background p-5">
                          <div className="mb-5 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Project details</p>
                              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Business and execution data</h2>
                            </div>
                            <Badge variant="secondary">Jira-style issue view</Badge>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {projectDetails.map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Project narrative</p>
                            <div className="mt-4 space-y-4">
                              {noteSections.map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-border/70 bg-card px-4 py-4">
                                  <p className="text-sm font-semibold text-foreground">{label}</p>
                                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-5">
                            <div className="rounded-2xl border border-border/70 bg-background p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checklist progress</p>
                                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                                    {completedChecklist}/{project.checklist.length} complete
                                  </h3>
                                </div>
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              </div>
                              <Progress
                                value={project.checklist.length ? (completedChecklist / project.checklist.length) * 100 : 0}
                                className="mt-4 h-2.5 rounded-full bg-secondary"
                              />

                              <div className="mt-4 space-y-2">
                                {Object.entries(
                                  project.checklist.reduce(
                                    (acc, item) => {
                                      const bucket = acc[item.ownerTeam] || { done: 0, total: 0 };
                                      bucket.total += 1;
                                      if (item.completed) bucket.done += 1;
                                      acc[item.ownerTeam] = bucket;
                                      return acc;
                                    },
                                    {} as Record<string, { done: number; total: number }>,
                                  ),
                                ).map(([team, summary]) => (
                                  <div key={team} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{teamLabels[team] || team}</p>
                                      <p className="text-xs text-muted-foreground">{summary.done} of {summary.total} closed</p>
                                    </div>
                                    <Badge variant="outline">{summary.done}/{summary.total}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-background p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick links</p>
                                  <h3 className="mt-1 text-lg font-semibold text-foreground">Working context</h3>
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-primary" />
                              </div>

                              <div className="mt-4 space-y-2">
                                {quickLinks.length > 0 ? (
                                  quickLinks.map((link) => (
                                    <a
                                      key={link.label}
                                      href={link.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3 text-sm font-semibold transition hover:border-primary/25 hover:bg-accent/40"
                                    >
                                      <div className="flex items-center gap-3">
                                        <link.icon className="h-4 w-4" />
                                        <span>{link.label}</span>
                                      </div>
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                    No linked documents or external tools attached yet.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="activity" className="m-0">
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-border/70 bg-background px-5 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activity timeline</p>
                              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Project updates and delivery history</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="border border-slate-200 bg-slate-100 text-slate-700">{activityFeed.length} events</Badge>
                              <Badge className="border border-blue-200 bg-blue-50 text-blue-700">Color-coded types</Badge>
                            </div>
                          </div>
                        </div>

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
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-background p-5">
                                  <div className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                                      {item.actor.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">{item.title}</p>
                                        <span
                                          className={cn(
                                            "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                                            activityBadgeToneMap[item.kind],
                                          )}
                                        >
                                          {item.kind}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        {item.actor} · {item.timestampLabel}
                                      </p>
                                      <p className="mt-4 text-sm leading-7 text-foreground">{item.description}</p>
                                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                        <span>{item.source}</span>
                                        <button type="button" className="font-medium text-foreground hover:text-primary">
                                          Reply
                                        </button>
                                        <button type="button" className="font-medium text-foreground hover:text-primary">
                                          Copy link
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 pt-1">
                                      <span className={cn("h-3.5 w-3.5 rounded-full", activityToneMap[item.kind])} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {activityFeed.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                            <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-sm font-semibold text-foreground">No activity captured yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Handoffs, checklist updates, notes, and milestones will appear here.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="checklists" className="m-0" />

                    <TabsContent value="notes" className="m-0">
                      <div className="space-y-4">
                        {noteSections.map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-border/70 bg-background p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                            <p className="mt-4 text-sm leading-7 text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="files" className="m-0">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {quickLinks.length > 0 ? (
                          quickLinks.map((link) => (
                            <a
                              key={link.label}
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-border/70 bg-background p-4 transition hover:border-primary/25"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <link.icon className="h-4 w-4" />
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="mt-4 text-sm font-semibold text-foreground">{link.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Open linked project artifact</p>
                            </a>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                            No files are linked to this project yet.
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>

              <aside className="bg-card px-5 py-5 lg:px-6">
                <div className="sticky top-6 max-h-[calc(100vh-3rem)] space-y-4 overflow-y-auto pr-1">
                  <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        {aiSummaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI Summary</p>
                        <p className="text-sm text-muted-foreground">Live project readout generated from delivery data</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {aiSummaryLoading ? (
                        <div className="rounded-xl border border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                          Generating summary...
                        </div>
                      ) : aiSummaryError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                          AI summary unavailable: {aiSummaryError}
                        </div>
                      ) : (
                        summaryCards.map((card, index) => (
                          <div key={card.title} className={cn("rounded-xl border px-4 py-4", card.tone, index === 0 && "border-primary/20")}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{card.title}</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">{card.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recommended actions</p>
                        <p className="mt-1 text-sm text-muted-foreground">Context-aware actions similar to a Jira issue sidebar.</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {actionRecommendations.map((action) =>
                        action.href ? (
                          <a
                            key={action.label}
                            href={action.href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start justify-between rounded-xl border border-border/70 bg-card px-4 py-3 transition hover:border-primary/25 hover:bg-accent/40"
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">{action.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{action.sublabel}</p>
                            </div>
                            <ExternalLink className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          </a>
                        ) : (
                          <button
                            key={action.label}
                            type="button"
                            onClick={action.onClick}
                            className="w-full rounded-xl border border-border/70 bg-card px-4 py-3 text-left transition hover:border-primary/25 hover:bg-accent/40"
                          >
                            <p className="text-sm font-semibold text-foreground">{action.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{action.sublabel}</p>
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Details</p>
                    </div>

                    <div className="space-y-3">
                      {detailRows.map(([label, value]) => (
                        <div key={label} className="grid grid-cols-[116px_minmax(0,1fr)] gap-3 text-sm">
                          <p className="text-muted-foreground">{label}</p>
                          <p className="font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Files className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Links and artifacts</p>
                    </div>

                    <div className="space-y-2">
                      {quickLinks.length > 0 ? (
                        quickLinks.map((link) => (
                          <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3 text-sm font-semibold transition hover:border-primary/25 hover:bg-accent/40"
                          >
                            <span>{link.label}</span>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </a>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                          No linked artifacts yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onSave={handleSaveEdit} />
      <ChecklistDialog project={project} open={checklistOpen} onOpenChange={setChecklistOpen} />
      <AssignOwnerDialog project={project} open={assignOpen} onOpenChange={setAssignOpen} />
      <TransferDialog project={project} open={transferOpen} onOpenChange={setTransferOpen} onTransfer={handleTransfer} />

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
