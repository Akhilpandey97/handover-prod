import { useState } from "react";
import { Project, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { ChecklistDialog } from "./ChecklistDialog";
import { EditProjectDialog } from "./EditProjectDialog";
import { TransferDialog } from "./TransferDialog";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  FileText,
  ClipboardList,
  Pencil,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

const phaseColors = {
  mint: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  integration: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
  ms: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
  completed: "bg-muted text-muted-foreground",
};

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject, updateProject } = useProjects();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const completedChecklist = project.checklist.filter((c) => c.completed).length;
  const totalChecklist = project.checklist.length;
  
  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const canTransfer = currentUser?.team === project.currentOwnerTeam && 
    !project.pendingAcceptance && 
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";

  const handleAccept = () => {
    acceptProject(project.id);
    toast.success(`Accepted ${project.merchantName}`);
  };

  const handleTransfer = (assigneeId: string, assigneeName: string, notes: string) => {
    const nextTeam = project.currentOwnerTeam === "mint" ? "Integration" : "MS";
    const transferNote = notes || `Transferred to ${nextTeam} team`;
    transferProject(project.id, `${transferNote} (Assigned to: ${assigneeName})`, assigneeId);
    toast.success(`Transferred ${project.merchantName} to ${assigneeName} (${nextTeam} team)`);
  };

  const handleSaveEdit = (updatedProject: Project) => {
    updateProject(updatedProject);
    toast.success("Project updated successfully");
  };

  const getResponsibilityLabel = () => {
    if (computedResponsibility === "gokwik") return "GoKwik";
    if (computedResponsibility === "merchant") return "Merchant";
    return "Neutral";
  };

  const getResponsibilityClass = () => {
    if (computedResponsibility === "gokwik") return "text-primary";
    if (computedResponsibility === "merchant") return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <>
      <Card className="hover:shadow-sm transition-shadow border-border/60">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Project Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-medium text-sm truncate">{project.merchantName}</h3>
                  {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                    <Badge className="bg-amber-500/90 text-white text-[10px] px-1.5 py-0 h-4 animate-pulse">
                      New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{project.mid.slice(0, 20)}...</span>
                  <Badge variant="outline" className={`${phaseColors[project.currentPhase]} text-[10px] px-1.5 py-0 h-4 font-medium`}>
                    {project.currentPhase.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Center: Status */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Pending:</span>
                <span className={`font-medium ${getResponsibilityClass()}`}>{getResponsibilityLabel()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3 w-3 text-primary" />
                <span>{formatDuration(timeByParty.gokwik)}</span>
                <span className="text-muted-foreground/50">|</span>
                <Clock className="h-3 w-3 text-amber-500" />
                <span>{formatDuration(timeByParty.merchant)}</span>
              </div>
            </div>

            {/* Right: Metrics & Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-3 text-xs pr-2 border-r border-border/60">
                <div className="text-center">
                  <p className="font-semibold text-primary">{project.arr}cr</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{project.goLivePercent}%</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{completedChecklist}/{totalChecklist}</p>
                </div>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-popover">
                  <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChecklistOpen(true)}>
                    <ClipboardList className="h-3.5 w-3.5 mr-2" />
                    Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Accept Button */}
              {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                <Button size="sm" onClick={handleAccept} className="h-8 text-xs gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept
                </Button>
              )}

              {/* Transfer Button */}
              {canTransfer && (
                <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} className="h-8 text-xs gap-1">
                  Transfer
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProjectDetailsDialog
        project={project}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
      <ChecklistDialog
        project={project}
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
      />
      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveEdit}
      />
      <TransferDialog
        project={project}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onTransfer={handleTransfer}
      />
    </>
  );
};
