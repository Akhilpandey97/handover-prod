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

  const total = project.checklist.length;
  const pct = total === 0 ? 0 : Math.round((completedChecklist / total) * 100);

  const accent =
    project.projectState === "blocked" || isRejected
      ? "bg-destructive"
      : isPending || project.projectState === "on_hold"
      ? "bg-warning"
      : project.projectState === "live"
      ? "bg-success"
      : pct > 0
      ? "bg-primary-glow"
      : "bg-transparent";

  const waitingOn =
    project.currentResponsibility === "merchant"
      ? "Merchant"
      : project.currentResponsibility === "gokwik"
      ? teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam
      : "—";

  const goLive = project.dates.expectedGoLiveDate
    ? new Date(project.dates.expectedGoLiveDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "—";

  const subLine = isRejected
    ? `Sent back${lastTransfer?.notes ? ` — ${lastTransfer.notes.replace("REJECTED:", "").trim()}` : ""}`
    : isPending
    ? "Waiting for you to accept"
    : project.projectState === "blocked"
    ? "Blocked — needs attention"
    : null;

  return (
    <>
      <Card className="relative w-full overflow-hidden rounded-lg border border-border bg-card shadow-none transition-colors hover:border-primary/40">
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", accent)} />
        <div className="grid grid-cols-1 items-center gap-3 py-3 pl-4 pr-3 lg:grid-cols-[minmax(0,1fr)_120px_180px_130px_90px_150px]">
          {/* Project */}
          <Link to={`/projects/${project.id}`} className="group min-w-0">
            <h3 className="truncate font-display text-[15px] font-bold tracking-tight text-primary group-hover:underline">
              {project.merchantName}
            </h3>
            <p className="font-mono text-[11px] text-muted-foreground">MID {project.mid}</p>
            {subLine && (
              <p className="mt-1 text-[12px] font-semibold leading-snug text-destructive">{subLine}</p>
            )}
          </Link>

          {/* State */}
          <div>
            <Badge className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", projectStateColors[project.projectState])}>
              {isPending ? "To accept" : isRejected ? "Sent back" : stateLabels[project.projectState] || projectStateLabels[project.projectState]}
            </Badge>
          </div>

          {/* Checklist */}
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[13px] text-foreground">{completedChecklist}/{total}</span>
              <span className="font-mono text-[12px] text-muted-foreground">{pct}%</span>
            </div>
            <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary-glow")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Waiting on */}
          <div className="truncate text-[13px] font-semibold text-foreground">{waitingOn}</div>

          {/* Go-live */}
          <div className={cn("text-[13px] font-semibold", project.projectState === "blocked" ? "text-destructive" : "text-foreground")}>
            {goLive}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            {project.assignedOwnerName && !isPending && !canTransfer && (
              <span className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
                <User className="h-3 w-3" />
                {project.assignedOwnerName}
              </span>
            )}
            {isPending && (
              <Button size="sm" className="h-8 gap-1 rounded-md text-[12px]" onClick={handleAccept}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Accept
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="outline" className="h-8 gap-1 rounded-md border-destructive/40 text-[12px] text-destructive hover:bg-destructive/10" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            )}
            {canTransfer && (
              <Button
                size="sm"
                variant={isTransferReady ? "default" : "outline"}
                className="h-8 gap-1 rounded-md text-[12px]"
                onClick={() => isTransferReady && setTransferOpen(true)}
                disabled={!isTransferReady}
              >
                {isTransferReady ? (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    Transfer
                  </>
                ) : (
                  <>Transfer — {total - completedChecklist} left</>
                )}
              </Button>
            )}
            {!isPending && !canTransfer && !canReject && project.projectState === "live" && (
              <span className="text-[12px] font-semibold text-success">Handed over</span>
            )}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </Card>

      <TransferDialog project={project} open={transferOpen} onOpenChange={setTransferOpen} onTransfer={handleTransfer} />
      <RejectTransferDialog project={project} open={rejectOpen} onOpenChange={setRejectOpen} onReject={handleReject} />
    </>
  );
};

