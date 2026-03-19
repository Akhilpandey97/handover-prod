import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Project,
  ProjectState,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateLabels,
} from "@/data/projectsData";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
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

const MetricTile = ({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) => (
  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    {children ?? <p className="mt-2 text-sm font-semibold text-foreground">{value || "—"}</p>}
  </div>
);

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject, updateProject, rejectProject } = useProjects();
  const { teamLabels, responsibilityLabels, getLabel, stateLabels } = useLabels();

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
    currentUser?.team === project.currentOwnerTeam &&
    currentUser?.id === project.assignedOwner;

  const isPending = project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam;
  const canReject = isPending && (currentUser?.team === "integration" || currentUser?.team === "ms");
  const canTransfer =
    currentUser?.team === project.currentOwnerTeam &&
    !project.pendingAcceptance &&
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";
  const isTransferReady = canTransfer && allCurrentTeamChecklistCompleted;

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

  const handleAiAction = async (type: "insights" | "summary") => {
    setAiDialogType(type);
    setAiDialogOpen(true);
    setAiLoading(true);
    setAiResult("");

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-project-insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ project, type }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setAiResult(data.result || "No insights generated.");
    } catch (error: any) {
      setAiResult(`Failed to generate AI output. ${error.message || "Please try again."}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Link
              to={`/projects/${project.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/40 bg-muted/10 px-3 py-3 transition-colors hover:bg-muted/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background">
                <Building2 className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">{project.merchantName}</h3>
                  <Badge variant="outline">MID {project.mid}</Badge>
                  <Badge variant="secondary">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
                  {project.assignedOwnerName && (
                    <Badge variant="outline" className="gap-1">
                      <User className="h-3 w-3" />
                      {project.assignedOwnerName}
                    </Badge>
                  )}
                  {isPending && <Badge>Pending</Badge>}
                  {isRejected && <Badge variant="destructive">Action needed</Badge>}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{project.platform || "Platform not set"}</span>
                  <span>•</span>
                  <span>{project.category || "Category not set"}</span>
                  <span>•</span>
                  <span>{completedChecklist}/{project.checklist.length} checklist done</span>
                  <span>•</span>
                  <span>{stateLabels[project.projectState] || projectStateLabels[project.projectState]}</span>
                </div>
              </div>

              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {isPending && (
                <Button size="sm" className="gap-2" onClick={handleAccept}>
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </Button>
              )}

              {canReject && (
                <Button size="sm" variant="destructive" className="gap-2" onClick={() => setRejectOpen(true)}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}

              {canTransfer && (
                <Button
                  size="sm"
                  variant={isTransferReady ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => isTransferReady && setTransferOpen(true)}
                  disabled={!isTransferReady}
                >
                  <ArrowRight className="h-4 w-4" />
                  Transfer
                </Button>
              )}

              <Button size="icon" variant="ghost" onClick={() => setIsExpanded((value) => !value)} aria-label="Toggle project details">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile label={getLabel("field_arr")} value={`${project.arr} Cr`} />
                <MetricTile label="Action pending on" value={responsibilityLabels[computedResponsibility] || computedResponsibility} />
                <MetricTile label="Time split" value={`${formatDuration(timeByParty.gokwik)} / ${formatDuration(timeByParty.merchant)}`} />
                <MetricTile label="Checklist" value={`${completedChecklist}/${project.checklist.length} complete`} />
                <MetricTile label={getLabel("field_kick_off_date")} value={project.dates.kickOffDate || "—"} />
                <MetricTile label={getLabel("field_go_live_date")} value={project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—"} />
                <MetricTile label="Current phase" value={projectPhaseDisplay} />
                <MetricTile label="Project state">
                  <Select value={project.projectState} onValueChange={(value) => handleStateChange(value as ProjectState)}>
                    <SelectTrigger className="mt-2 h-8 border-border/60 bg-background px-3 text-sm font-semibold text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(projectStateLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {stateLabels[key as ProjectState] || label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </MetricTile>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <Badge variant="outline">{teamLabels.mint}: {mintChecklist.filter((item) => item.completed).length}/{mintChecklist.length}</Badge>
                <Badge variant="outline">{teamLabels.integration}: {integrationChecklist.filter((item) => item.completed).length}/{integrationChecklist.length}</Badge>
                <Button size="sm" variant="ghost" className="gap-2" onClick={() => handleAiAction("insights")}>
                  <Brain className="h-4 w-4" />
                  AI Insights
                </Button>
                <Button size="sm" variant="ghost" className="gap-2" onClick={() => handleAiAction("summary")}>
                  <ListChecks className="h-4 w-4" />
                  AI Task Summary
                </Button>
              </div>
            </div>
          )}
        </div>
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
