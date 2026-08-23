import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Project,
  projectStateColors,
  projectStateLabels,
} from "@/data/projectsData";
import { computeHealthScore } from "@/utils/aiHealthScore";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransferDialog } from "./TransferDialog";
import { RejectTransferDialog } from "./RejectTransferDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  User,
  XCircle,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject, rejectProject } = useProjects();
  const { teamLabels, stateLabels } = useLabels();

  const [transferOpen, setTransferOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const completedChecklist = project.checklist.filter((item) => item.completed).length;
  const healthScore = computeHealthScore(project);

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

  return (
    <>
      <Card
        className="overflow-hidden w-full surface-card border-0 bg-card"
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {/* Project strip */}
          <Link
            to={`/projects/${project.id}`}
            className="relative flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors overflow-hidden group hover:bg-accent/70"
          >
            {/* Completion percentage pill */}
            {(() => {
              const totalItems = project.checklist.length;
              if (totalItems === 0) return null;
              const pct = Math.round((project.checklist.filter(c => c.completed).length / totalItems) * 100);
              return (
                <span className={cn(
                  "relative z-10 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  pct === 100
                    ? "bg-success/15 text-success"
                    : pct >= 50
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {pct}%
                </span>
              );
            })()}
            <div className="relative min-w-0 flex-1 flex flex-wrap items-center gap-1.5 z-10">
              <h3 className="truncate text-[13px] font-semibold tracking-tight text-foreground">{project.merchantName}</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-medium">MID {project.mid}</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px]">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
              <Badge className={cn("text-[10px] px-1.5 py-0 h-[18px]", projectStateColors[project.projectState])}>
                {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
              </Badge>
              {project.assignedOwnerName && (
                <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-[18px]">
                  <User className="h-2.5 w-2.5" />
                  {project.assignedOwnerName}
                </Badge>
              )}
              {isPending && <Badge className="text-[10px] px-1.5 py-0 h-[18px]">Pending</Badge>}
              {isRejected && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-[18px]">Action needed</Badge>}
              {healthScore.label !== "Healthy" && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-[18px] border-current"
                  style={{ color: healthScore.color }}
                  title={healthScore.factors.join("; ")}
                >
                  {healthScore.label} {healthScore.score}
                </Badge>
              )}
            </div>
            <ArrowUpRight className="relative h-3.5 w-3.5 text-primary shrink-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>


          <div className="flex items-center gap-1 shrink-0">
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
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 pb-2 text-[11px] text-muted-foreground">
          <span>Checklist {completedChecklist}/{project.checklist.length}</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{project.dates.expectedGoLiveDate ? `Go-live ${project.dates.expectedGoLiveDate}` : "No go-live date"}</span>
        </div>
      </Card>

      <TransferDialog project={project} open={transferOpen} onOpenChange={setTransferOpen} onTransfer={handleTransfer} />
      <RejectTransferDialog project={project} open={rejectOpen} onOpenChange={setRejectOpen} onReject={handleReject} />

    </>
  );
};
