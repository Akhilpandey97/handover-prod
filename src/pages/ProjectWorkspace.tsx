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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { WorkspaceSkeleton } from "@/components/skeletons/WorkspaceSkeleton";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  ExternalLink,
  FileStack,
  Files,
  Globe,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

type WorkspaceTab = "overview" | "activity" | "checklists" | "notes" | "files";
type ActivityKind = "user" | "system" | "handoff" | "milestone";

const PROJECT_STATES: ProjectState[] = ["not_started", "on_hold", "in_progress", "live", "blocked"];

interface ProjectWorkspaceProps {
  projectId?: string;
  inModal?: boolean;
  onClose?: () => void;
  projectIds?: string[];
  onNavigate?: (id: string) => void;
}

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
  not_started: "bg-[#eff4fb] text-[#5d718f] border-[#d8e2f0]",
  on_hold: "bg-[#fff4db] text-[#9a6700] border-[#ffe3a3]",
  in_progress: "bg-[#edf3ff] text-[#244b8f] border-[#d3e0f7]",
  live: "bg-[#ecf8f1] text-[#246447] border-[#d2eadb]",
  blocked: "bg-[#fff0f0] text-[#b5474d] border-[#ffd2d5]",
};

const stateSelectToneMap: Record<ProjectState, string> = {
  not_started: "border-[#d8e2f0] bg-[#eff4fb] text-[#5d718f]",
  on_hold: "border-[#ffe3a3] bg-[#fff4db] text-[#9a6700]",
  in_progress: "border-[#d3e0f7] bg-[#edf3ff] text-[#244b8f]",
  live: "border-[#d2eadb] bg-[#ecf8f1] text-[#246447]",
  blocked: "border-[#ffd2d5] bg-[#fff0f0] text-[#b5474d]",
};

const activityToneMap: Record<ActivityKind, string> = {
  user: "bg-emerald-500",
  system: "bg-slate-500",
  handoff: "bg-blue-500",
  milestone: "bg-amber-500",
};

const activityBadgeToneMap: Record<ActivityKind, string> = {
  user: "bg-[#ecf8f1] text-[#246447] border-[#d2eadb]",
  system: "bg-[#eff4fb] text-[#5d718f] border-[#d8e2f0]",
  handoff: "bg-[#edf3ff] text-[#244b8f] border-[#d3e0f7]",
  milestone: "bg-[#fff4db] text-[#9a6700] border-[#ffe3a3]",
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
        ? "All current-team checklist items are complete. Review delivery context and transition ownership to the next team."
        : nextPending
          ? `Prioritize "${nextPending.title}" with the ${project.currentOwnerTeam} team to maintain delivery momentum.`
          : "No immediate execution blocker is visible in the current delivery data.",
      tone: "border-[#d3e0f7] bg-[#f5f8fc]",
    },
    {
      title: "Delivery status",
      body: `${project.merchantName} is in ${project.currentPhase} and currently marked ${project.projectState.replace(/_/g, " ")} with ${completedChecklist}/${project.checklist.length} checklist items complete.`,
      tone: "border-[#d8e2f0] bg-white",
    },
    {
      title: "Risk watch",
      body:
        risk.drivers[0]?.points && risk.drivers[0].points > 0
          ? `${risk.label} (score ${risk.score}). Primary driver: ${risk.drivers[0].label}.`
          : `${risk.label} (score ${risk.score}). No material execution or ownership risk is currently detected.`,
      tone: "border-[#d8e2f0] bg-white",
    },
    {
      title: "Operational insight",
      body:
        aiSignal ||
        `${openTasksCount} checklist item${openTasksCount === 1 ? "" : "s"} remain open. Review notes, handoff readiness, and linked documentation before the next status update.`,
      tone: "border-[#d8e2f0] bg-white",
    },
  ];

  return cards;
};

export const ProjectWorkspaceView = ({ projectId: projectIdProp, inModal = false, onClose, projectIds, onNavigate }: ProjectWorkspaceProps) => {
  const { projectId: routeProjectId } = useParams();
  const projectId = projectIdProp || routeProjectId;
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
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string[]>([]);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ownership: true,
    execution: true,
  });

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

  const { isLoading: projectsLoading } = useProjects();

  if (isLoading || projectsLoading) {
    return <WorkspaceSkeleton inModal={inModal} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!project) {
    return (
      <div className={cn("flex items-center justify-center bg-background px-6", inModal ? "min-h-full" : "min-h-screen")}>
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              This project could not be found in your current workspace.
            </p>
            {inModal ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <Button asChild>
                <Link to="/">Back to dashboard</Link>
              </Button>
            )}
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
    ["Original estimate", formatDuration(timeByParty.gokwik + timeByParty.merchant)],
    ["Merchant time", formatDuration(timeByParty.merchant)],
    ["Internal time", formatDuration(timeByParty.gokwik)],
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
    !project.assignedOwnerName && currentUser?.team === "manager"
      ? { label: "Assign owner", sublabel: "Establish clear ownership", onClick: () => setAssignOpen(true) }
      : null,
    project.links.jiraLink
      ? { label: "Open delivery tracker", sublabel: "Review execution tracking", href: project.links.jiraLink }
      : { label: "Add tracker link", sublabel: "Attach execution artifacts", onClick: () => setEditOpen(true) },
    openTasksCount > 0
      ? {
          label: "Review pending checklist",
          sublabel: `${openTasksCount} item${openTasksCount === 1 ? "" : "s"} require attention`,
          onClick: () => setActiveTab("checklists"),
        }
      : null,
    risk.label !== "Low risk"
      ? { label: "Review activity", sublabel: "Inspect blockers and handoffs", onClick: () => setActiveTab("activity") }
      : { label: "Update notes", sublabel: "Capture current delivery context", onClick: () => setActiveTab("notes") },
    canTransfer && isTransferReady
      ? { label: "Initiate transfer", sublabel: "Ownership can progress", onClick: () => setTransferOpen(true) }
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

  const handleStateChange = (newState: ProjectState) => {
    updateProject({ ...project, projectState: newState });
    toast.success(`Project state updated to ${projectStateLabels[newState]}`);
  };

  return (
    <div className={cn("flex flex-col overflow-hidden bg-background", inModal ? "h-full rounded-2xl border border-border/60" : "h-screen")}>
      {/* Unified header */}
      <div className="shrink-0 border-b border-border/60 bg-card/80 px-4 py-2">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {inModal ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kanban
              </button>
            ) : (
              <Link to="/" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground shrink-0">
                <ArrowLeft className="h-3.5 w-3.5" />
                Projects
              </Link>
            )}
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[2.05rem] font-semibold tracking-tight text-foreground truncate">{project.merchantName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {inModal ? (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
            {currentUser?.team === "manager" ? (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setAssignOpen(true)}>
                <UserRound className="h-3 w-3 mr-1" />
                Assign
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => isTransferReady && setTransferOpen(true)} disabled={!isTransferReady}>
              <ArrowRight className="h-3 w-3 mr-1" />
              Transfer
            </Button>
            {currentUser?.team === "manager" ? (
              <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3-panel body */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1">
        {/* LEFT PANEL — Ownership & Context */}
        <ScrollArea className="w-[240px] shrink-0 border-r border-border/60 bg-card/50">
          <div className="p-4 space-y-1">
            <div className="pb-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold">MID {project.mid}</Badge>
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project state</p>
              <Select value={project.projectState} onValueChange={(v) => handleStateChange(v as ProjectState)}>
                <SelectTrigger className={cn("h-11 rounded-full text-base font-semibold border-2", stateSelectToneMap[project.projectState])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn(inModal && "z-[90]")}>
                  {PROJECT_STATES.map((state) => (
                    <SelectItem key={state} value={state} className={cn("rounded-2xl my-1 text-base font-medium", stateSelectToneMap[state])}>
                      {stateLabels[state] || projectStateLabels[state]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-px bg-border/50" />

            {/* Collapsible sections */}
            {[
              {
                key: "ownership",
                title: "Ownership",
                content: (
                  <div className="space-y-2">
                    {[
                      ["Owner", project.assignedOwnerName || "Unassigned"],
                      ["Team", teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam],
                      ["Phase", phaseLabels[project.currentPhase] || project.currentPhase],
                      ["Sales SPOC", project.salesSpoc || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="text-xs font-semibold text-foreground text-right truncate max-w-[120px]">{value}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "execution",
                title: "Execution",
                content: (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Responsibility</p>
                      <p className="text-xs font-semibold text-foreground">{responsibilityLabels[pendingOn] || pendingOn}</p>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Checklist</p>
                      <p className="text-xs font-semibold text-foreground">{completedChecklist}/{project.checklist.length}</p>
                    </div>
                    <Progress
                      value={project.checklist.length ? (completedChecklist / project.checklist.length) * 100 : 0}
                      className="h-1.5 rounded-full bg-secondary"
                    />
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="rounded-md border border-border/60 bg-card/80 px-2 py-1.5 text-center">
                        <p className="text-xs font-bold text-foreground">{formatDuration(timeByParty.gokwik)}</p>
                        <p className="text-[8px] uppercase tracking-widest text-muted-foreground">Internal</p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-card/80 px-2 py-1.5 text-center">
                        <p className="text-xs font-bold text-foreground">{formatDuration(timeByParty.merchant)}</p>
                        <p className="text-[8px] uppercase tracking-widest text-muted-foreground">Merchant</p>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "risk",
                title: "Risk",
                content: (
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border text-[10px] font-semibold", risk.tone)}>{risk.label}</Badge>
                      <span className="text-[10px] font-semibold text-muted-foreground">Score {risk.score}</span>
                    </div>
                    {risk.drivers[0]?.points > 0 ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{risk.drivers[0].label}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "dates",
                title: "Key dates",
                content: (
                  <div className="space-y-1.5">
                    {[
                      ["Kick-off", project.dates.kickOffDate || "—"],
                      ["Expected go-live", project.dates.expectedGoLiveDate || "—"],
                      ["Go-live", project.dates.goLiveDate || "—"],
                      ["Last update", getLastUpdated(project)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="text-[11px] font-semibold text-foreground text-right truncate max-w-[110px]">{value}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "business",
                title: "Business",
                content: (
                  <div className="space-y-1.5">
                    {[
                      ["Platform", project.platform],
                      ["Category", project.category || "—"],
                      ["ARR", `${project.arr} Cr`],
                      ["Txn / day", `${project.txnsPerDay}`],
                      ["AOV", `₹${project.aov.toLocaleString()}`],
                      ["Integration", project.integrationType || "—"],
                      ["PG onboarding", project.pgOnboarding || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="text-[11px] font-semibold text-foreground text-right truncate max-w-[110px]">{value}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "links",
                title: "Links",
                content: (
                  <div className="space-y-1">
                    {quickLinks.length > 0 ? (
                      quickLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border border-border/60 bg-card/80 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:bg-accent/60"
                        >
                          <div className="flex items-center gap-1.5">
                            <link.icon className="h-3 w-3" />
                            <span>{link.label}</span>
                          </div>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </a>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No links attached.</p>
                    )}
                  </div>
                ),
              },
            ].map((section) => (
              <div key={section.key}>
                <div className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                    className="flex w-full items-center justify-between group"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{section.title}</p>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", expandedSections[section.key] ? "rotate-0" : "-rotate-90")} />
                  </button>
                  {expandedSections[section.key] && (
                    <div className="mt-2">{section.content}</div>
                  )}
                </div>
                <div className="h-px bg-border/50" />
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* CENTER PANEL — Tabs */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border/60 px-4 py-1.5">
              <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
                {tabOptions.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded border border-transparent px-4 py-1.5 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* OVERVIEW TAB — Rich dashboard */}
              <TabsContent value="overview" className="m-0">
                <div className="space-y-3">
                  {/* Key Metrics Row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Checklist Progress", value: `${completedChecklist}/${project.checklist.length}`, sub: `${project.checklist.length ? Math.round((completedChecklist / project.checklist.length) * 100) : 0}% complete` },
                      { label: "Go-Live %", value: `${project.goLivePercent}%`, sub: project.projectState === "live" ? "Live" : "In progress" },
                      { label: "Risk Score", value: `${risk.score}`, sub: risk.label },
                      { label: "Handoffs", value: `${project.transferHistory.length}`, sub: `${activityFeed.length} total events` },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-border/60 bg-card/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
                        <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{metric.value}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Checklist by team + Timeline snapshot */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Checklist breakdown */}
                    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checklist by team</p>
                      <div className="mt-2 space-y-1.5">
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
                          <div key={team}>
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-xs font-semibold text-foreground">{teamLabels[team] || team}</p>
                              <span className="text-[11px] font-semibold text-muted-foreground">{summary.done}/{summary.total}</span>
                            </div>
                            <Progress value={summary.total ? (summary.done / summary.total) * 100 : 0} className="h-1 bg-secondary" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent activity snapshot */}
                    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent activity</p>
                        <button type="button" onClick={() => setActiveTab("activity")} className="text-[11px] font-semibold text-primary hover:underline">View all</button>
                      </div>
                      <div className="space-y-1.5">
                        {activityFeed.slice(0, 4).map((item) => (
                          <div key={item.id} className="flex items-start gap-2">
                            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", activityToneMap[item.kind])} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground">{item.actor} · {item.timestampLabel}</p>
                            </div>
                          </div>
                        ))}
                        {activityFeed.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No activity recorded.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Notes summary */}
                  <div className="rounded-lg border border-border/60 bg-card/80 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Project notes</p>
                      <button type="button" onClick={() => setActiveTab("notes")} className="text-[11px] font-semibold text-primary hover:underline">View all</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {noteSections.map(([label, value]) => (
                        <div key={label} className="rounded-md border border-border/40 bg-background/60 px-2.5 py-2">
                          <p className="text-[11px] font-semibold text-foreground">{label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick links grid */}
                  {quickLinks.length > 0 ? (
                    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Quick links</p>
                      <div className="flex flex-wrap gap-1.5">
                        {quickLinks.map((link) => (
                          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent/60">
                            <link.icon className="h-3 w-3" />
                            {link.label}
                            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="m-0">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activity timeline</p>
                      <p className="text-sm font-semibold text-foreground">Execution history and delivery updates</p>
                    </div>
                    <Badge variant="outline" className="text-[11px]">{activityFeed.length} events</Badge>
                  </div>

                  {Object.entries(groupedActivity).map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      <div className="mb-1.5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-border/50" />
                        <Badge variant="outline" className="px-2 py-0.5 text-[11px]">{dateLabel}</Badge>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>

                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border/60 bg-card/80 px-3 py-2.5">
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                {item.actor.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider", activityBadgeToneMap[item.kind])}>
                                    {item.kind}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{item.actor} · {item.timestampLabel}</p>
                                {item.description ? <p className="mt-1 text-sm leading-relaxed text-foreground">{item.description}</p> : null}
                                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span>{item.source}</span>
                                  <button type="button" className="font-medium text-primary hover:underline">Reply</button>
                                  <button type="button" className="font-medium text-primary hover:underline">Copy link</button>
                                </div>
                              </div>
                              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", activityToneMap[item.kind])} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {activityFeed.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
                      <MessageSquareText className="mx-auto h-5 w-5 text-muted-foreground" />
                      <p className="mt-1.5 text-xs font-semibold text-foreground">No activity recorded yet</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Handoffs, checklist updates, and milestones will appear here.</p>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="checklists" className="m-0 h-full">
                <div className="h-full min-h-[500px]">
                  <ChecklistDialog project={project} open={true} onOpenChange={() => undefined} variant="inline" />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="m-0">
                <div className="space-y-2">
                  {noteSections.map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border/60 bg-card/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="files" className="m-0">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {quickLinks.length > 0 ? (
                    quickLinks.map((link) => (
                      <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="rounded-lg border border-border/60 bg-card/80 p-3 transition hover:bg-accent/60">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <link.icon className="h-3.5 w-3.5" />
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-foreground">{link.label}</p>
                        <p className="text-[11px] text-muted-foreground">Open linked artifact</p>
                      </a>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-xs text-muted-foreground">
                      No files linked to this project yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </main>

        {/* RIGHT PANEL — Actions first, then AI */}
        <ScrollArea className="w-[280px] shrink-0 border-l border-border/60 bg-card/50">
          <div className="p-3 space-y-3">
            {/* Recommended Actions — highlighted, on top */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Recommended actions</p>
              <div className="mt-2 space-y-1">
                {actionRecommendations.map((action) =>
                  action.href ? (
                    <a
                      key={action.label}
                      href={action.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between rounded-md border border-primary/15 bg-card/90 px-2.5 py-2 transition hover:bg-accent/60"
                    >
                      <div>
                        <p className="text-xs font-semibold text-foreground">{action.label}</p>
                        <p className="text-[11px] text-muted-foreground">{action.sublabel}</p>
                      </div>
                      <ExternalLink className="mt-0.5 h-3 w-3 text-muted-foreground" />
                    </a>
                  ) : (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="w-full rounded-md border border-primary/15 bg-card/90 px-2.5 py-2 text-left transition hover:bg-accent/60"
                    >
                      <p className="text-xs font-semibold text-foreground">{action.label}</p>
                      <p className="text-[11px] text-muted-foreground">{action.sublabel}</p>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* AI Summary — compact */}
            <div className="rounded-lg border border-border/60 bg-card/80 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  {aiSummaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Executive summary</p>
              </div>

              <div className="space-y-1.5">
                {aiSummaryLoading ? (
                  <p className="text-xs text-muted-foreground">Generating summary...</p>
                ) : aiSummaryError ? (
                  <p className="text-xs text-warning">AI summary unavailable.</p>
                ) : (
                  summaryCards.map((card, index) => (
                    <div key={card.title} className={cn("rounded-md border px-2.5 py-2", index === 0 ? "border-primary/20 bg-primary/5" : "border-border/40 bg-background/60")}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{card.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground">{card.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onSave={handleSaveEdit} />
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

const ProjectWorkspace = () => <ProjectWorkspaceView />;

export default ProjectWorkspace;
