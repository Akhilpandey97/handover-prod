import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Project,
  ProjectState,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateColors,
  projectStateLabels,
} from "@/data/projectsData";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { fetchAiInsights } from "@/utils/aiInsights";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransferDialog } from "./TransferDialog";
import { RejectTransferDialog } from "./RejectTransferDialog";
import {
  Dialog,
  DialogContent,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { hexToRgba } from "@/utils/colorUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  User,
  XCircle,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

const MetricTile = ({
  label,
  value,
  children,
  borderColor,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  borderColor: string;
}) => (
  <div
    className="rounded-lg px-2.5 py-1.5"
    style={{
      backgroundColor: hexToRgba(borderColor, 0.06),
      border: `1px solid ${hexToRgba(borderColor, 0.35)}`,
    }}
  >
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    {children ?? <p className="mt-0.5 text-xs font-semibold text-foreground">{value || "—"}</p>}
  </div>
);

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject, updateProject, rejectProject } = useProjects();
  const { labels, teamLabels, responsibilityLabels, getLabel, stateLabels } = useLabels();

  const [isExpanded, setIsExpanded] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<"insights" | "summary">("insights");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const mintChecklist = project.checklist.filter((item) => item.ownerTeam === "mint");
  const integrationChecklist = project.checklist.filter((item) => item.ownerTeam === "integration");
  const completedChecklist = project.checklist.filter((item) => item.completed).length;
  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const currentTeamItems = project.checklist.filter((item) => item.ownerTeam === project.currentOwnerTeam);
  const nextIncompleteItem = currentTeamItems.find((item) => !item.completed) || project.checklist.find((item) => !item.completed);
  const projectPhaseDisplay = nextIncompleteItem ? nextIncompleteItem.title : "All Complete";

  const currentTeamChecklist = project.checklist.filter((item) => item.ownerTeam === project.currentOwnerTeam);
  const allCurrentTeamChecklistCompleted = currentTeamChecklist.length > 0 && currentTeamChecklist.every((item) => item.completed);

  const lastTransfer = project.transferHistory.length > 0 ? project.transferHistory[project.transferHistory.length - 1] : null;
  const isRejected =
    lastTransfer?.notes?.startsWith("REJECTED:") &&
    !project.pendingAcceptance &&
    currentUser?.team === project.currentOwnerTeam;

  const isPending = project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam;
  const canReject = isPending && (currentUser?.team === "integration" || currentUser?.team === "ms");
  const canTransfer =
    currentUser?.team === project.currentOwnerTeam &&
    !project.pendingAcceptance &&
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";
  const isTransferReady = canTransfer && allCurrentTeamChecklistCompleted;

  const projectStripBackground = labels.color_project_strip_bg || "#f8fbff";
  const projectStripBorder = labels.color_project_strip_border || "#d9e4f2";
  const projectStripOuterBackground = labels.color_project_strip_outer_bg || "#bfdbfe";
  const projectStripOuterBorder = labels.color_project_strip_outer_border || "#60a5fa";
  const projectExpandedBackground = labels.color_project_expanded_bg || "#fdfefe";
  const projectExpandedBorder = labels.color_project_expanded_border || "#dce6ef";

  const handleAccept = () => {
    acceptProject(project.id);
    toast.success(`Accepted ${project.merchantName}`);
  };

  const handleReject = (reason: string) => {
    rejectProject(project.id, reason);
    toast.success(`Rejected ${project.merchantName}`);
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
  };

  const { session } = useAuth();
  const handleAiAction = async (type: "insights" | "summary") => {
    setAiDialogType(type);
    setAiDialogOpen(true);
    setAiLoading(true);
    setAiResult("");

    try {
      const result = await fetchAiInsights({ project, type });
      setAiResult(result || "No insights generated.");
    } catch (error: any) {
      setAiResult(`Failed to generate AI output. ${error.message || "Please try again."}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <Card
        className="overflow-hidden shadow-sm transition-shadow hover:shadow-md w-full"
        style={{
          backgroundColor: projectStripOuterBackground,
          border: `1px solid ${projectStripOuterBorder}`,
        }}
      >
        <div className="flex flex-col gap-0 px-1.5 py-1">
          {/* Team checklist progress bar */}
          {(() => {
            const teams = ["mint", "integration", "ms"] as const;
            const teamColors = ["hsl(var(--primary))", "hsl(217 91% 60%)", "hsl(142 71% 45%)"];
            const segments = teams.map((t, i) => {
              const items = project.checklist.filter(c => c.ownerTeam === t);
              const done = items.filter(c => c.completed).length;
              return { total: items.length, done, color: teamColors[i] };
            });
            const totalItems = segments.reduce((s, seg) => s + seg.total, 0);
            if (totalItems === 0) return null;
            return (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60 flex">
                {segments.map((seg, i) => {
                  const widthPct = (seg.total / totalItems) * 100;
                  const fillPct = seg.total > 0 ? (seg.done / seg.total) * 100 : 0;
                  return (
                    <div key={i} className="relative h-full" style={{ width: `${widthPct}%` }}>
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: `${fillPct}%`, backgroundColor: seg.color, opacity: 0.85 }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <Link
            to={`/projects/${project.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors"
            style={{
              backgroundColor: projectStripBackground,
              border: `1px solid ${projectStripBorder}`,
            }}
          >
            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1">
              <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">{project.merchantName}</h3>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">MID {project.mid}</Badge>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
              {project.assignedOwnerName && (
                <Badge variant="outline" className="gap-0.5 text-[9px] px-1 py-0 h-4">
                  <User className="h-2 w-2" />
                  {project.assignedOwnerName}
                </Badge>
              )}
              {isPending && <Badge className="text-[9px] px-1 py-0 h-4">Pending</Badge>}
              {isRejected && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Action needed</Badge>}
            </div>
            <ArrowUpRight className="h-3 w-3 text-primary shrink-0" />
          </Link>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button size="sm" variant="ghost" className="gap-0.5 h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAiAction("insights")}>
              <Brain className="h-3 w-3" />
              Insights
            </Button>
            <Button size="sm" variant="ghost" className="gap-0.5 h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAiAction("summary")}>
              <ListChecks className="h-3 w-3" />
              Summary
            </Button>
            {isPending && (
              <Button size="sm" className="gap-0.5 h-6 text-[10px] px-1.5" onClick={handleAccept}>
                <CheckCircle2 className="h-3 w-3" />
                Accept
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="destructive" className="gap-0.5 h-6 text-[10px] px-1.5" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            )}
            {canTransfer && (
              <Button
                size="sm"
                variant={isTransferReady ? "default" : "outline"}
                className="gap-0.5 h-6 text-[10px] px-1.5"
                onClick={() => isTransferReady && setTransferOpen(true)}
                disabled={!isTransferReady}
              >
                <ArrowRight className="h-3 w-3" />
                Transfer
              </Button>
            )}
            <Button
              size="icon"
              className="h-6 w-6 bg-primary text-primary-foreground border-none shadow-sm"
              onClick={() => setIsExpanded((v) => !v)}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div
            className="space-y-1.5 rounded-md p-2 mx-1.5 mb-1.5"
            style={{
              backgroundColor: hexToRgba(projectExpandedBackground, 0.95),
              border: `1px solid ${hexToRgba(projectExpandedBorder, 0.86)}`,
            }}
          >
            <div className="grid gap-1 grid-cols-2 sm:grid-cols-4">
              <MetricTile borderColor={projectExpandedBorder} label={getLabel("field_arr")} value={`${project.arr} Cr`} />
              <MetricTile borderColor={projectExpandedBorder} label="Pending on" value={responsibilityLabels[computedResponsibility] || computedResponsibility} />
              <MetricTile borderColor={projectExpandedBorder} label="Time split" value={`${formatDuration(timeByParty.gokwik)} / ${formatDuration(timeByParty.merchant)}`} />
              <MetricTile borderColor={projectExpandedBorder} label="Checklist" value={`${completedChecklist}/${project.checklist.length}`} />
              <MetricTile borderColor={projectExpandedBorder} label={getLabel("field_kick_off_date")} value={project.dates.kickOffDate || "—"} />
              <MetricTile borderColor={projectExpandedBorder} label={getLabel("field_go_live_date")} value={project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—"} />
              <MetricTile borderColor={projectExpandedBorder} label="Phase" value={projectPhaseDisplay} />
              <MetricTile borderColor={projectExpandedBorder} label="State">
                <Select value={project.projectState} onValueChange={(value) => handleStateChange(value as ProjectState)}>
                  <SelectTrigger
                    className={cn(
                      "mt-0.5 h-8 rounded-full px-3 text-xs font-semibold shadow-none",
                      projectStateColors[project.projectState]
                    )}
                  >
                    <SelectValue>
                      {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl p-2">
                    {Object.entries(projectStateLabels).map(([key, label]) => (
                      <SelectItem
                        key={key}
                        value={key}
                        className={cn(
                          "mb-1 rounded-xl border text-sm font-semibold last:mb-0",
                          projectStateColors[key as ProjectState]
                        )}
                      >
                        {stateLabels[key as ProjectState] || label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MetricTile>
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 pt-1"
              style={{ borderTop: `1px solid ${hexToRgba(projectExpandedBorder, 0.52)}` }}
            >
              <Badge variant="outline" className="text-[10px]">{teamLabels.mint}: {mintChecklist.filter((i) => i.completed).length}/{mintChecklist.length}</Badge>
              <Badge variant="outline" className="text-[10px]">{teamLabels.integration}: {integrationChecklist.filter((i) => i.completed).length}/{integrationChecklist.length}</Badge>
            </div>
          </div>
        )}
      </Card>

      <TransferDialog project={project} open={transferOpen} onOpenChange={setTransferOpen} onTransfer={handleTransfer} />
      <RejectTransferDialog project={project} open={rejectOpen} onOpenChange={setRejectOpen} onReject={handleReject} />

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {aiDialogType === "insights" ? <Brain className="h-5 w-5 text-primary" /> : <ListChecks className="h-5 w-5 text-primary" />}
              {aiDialogType === "insights" ? "AI Project Insights" : "AI Task Summary"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="pr-4 text-sm leading-7 text-foreground">
              {aiLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </div>
              ) : (
                aiResult.split("\n").filter(Boolean).map((line, index) => (
                  <p key={index} className="mb-3">{line.replace(/^\s*[*-]\s*/, "")}</p>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
