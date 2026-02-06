import { useState } from "react";
import { Project, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  MoreVertical,
  FileText,
  ClipboardList,
  Pencil,
  Building2,
  Users,
  ExternalLink,
  Calendar,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

const phaseConfig = {
  mint: { 
    bg: "bg-gradient-to-r from-blue-500/10 to-blue-600/5", 
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-500 text-white",
    text: "text-blue-600 dark:text-blue-400"
  },
  integration: { 
    bg: "bg-gradient-to-r from-purple-500/10 to-purple-600/5", 
    border: "border-purple-200 dark:border-purple-800",
    badge: "bg-purple-500 text-white",
    text: "text-purple-600 dark:text-purple-400"
  },
  ms: { 
    bg: "bg-gradient-to-r from-emerald-500/10 to-emerald-600/5", 
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-500 text-white",
    text: "text-emerald-600 dark:text-emerald-400"
  },
  completed: { 
    bg: "bg-gradient-to-r from-gray-500/10 to-gray-600/5", 
    border: "border-gray-200 dark:border-gray-800",
    badge: "bg-gray-500 text-white",
    text: "text-gray-600 dark:text-gray-400"
  },
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
  const progress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;
  
  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const phaseStyle = phaseConfig[project.currentPhase];

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

  const getResponsibilityDisplay = () => {
    if (computedResponsibility === "gokwik") return { label: "GoKwik", icon: Building2, color: "text-primary" };
    if (computedResponsibility === "merchant") return { label: "Merchant", icon: Users, color: "text-amber-500" };
    return { label: "Neutral", icon: Clock, color: "text-muted-foreground" };
  };

  const responsibility = getResponsibilityDisplay();

  return (
    <>
      <Card className={`${phaseStyle.bg} ${phaseStyle.border} hover:shadow-xl transition-all duration-300 group overflow-hidden`}>
        <CardContent className="p-0">
          {/* Header Row */}
          <div className="p-5 pb-0">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Project Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg truncate">{project.merchantName}</h3>
                  {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                    <Badge className="bg-amber-500 text-white animate-pulse px-3 py-0.5 text-xs font-semibold">
                      <Sparkles className="h-3 w-3 mr-1" />
                      NEW
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">
                    {project.mid.slice(0, 16)}...
                  </span>
                  <Badge className={`${phaseStyle.badge} text-xs px-2 py-0.5`}>
                    {project.currentPhase.toUpperCase()}
                  </Badge>
                  {project.links.brandUrl && (
                    <a 
                      href={project.links.brandUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="text-xs">Website</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover">
                    <DropdownMenuItem onClick={() => setDetailsOpen(true)} className="gap-2">
                      <FileText className="h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChecklistOpen(true)} className="gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Open Checklist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Edit Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                  <Button onClick={handleAccept} className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Project
                  </Button>
                )}

                {canTransfer && (
                  <Button variant="outline" onClick={() => setTransferOpen(true)} className="gap-2">
                    Transfer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 pt-4">
            {/* ARR */}
            <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                ARR
              </p>
              <p className="text-lg font-bold">{project.arr} Cr</p>
            </div>

            {/* Go-Live */}
            <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Go-Live %
              </p>
              <p className="text-lg font-bold">{project.goLivePercent}%</p>
            </div>

            {/* Responsibility */}
            <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1">Pending With</p>
              <p className={`text-lg font-bold flex items-center gap-1 ${responsibility.color}`}>
                <responsibility.icon className="h-4 w-4" />
                {responsibility.label}
              </p>
            </div>

            {/* Time Tracked */}
            <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Time Tracked
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{formatDuration(timeByParty.gokwik)}</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold text-amber-500">{formatDuration(timeByParty.merchant)}</span>
              </div>
            </div>

            {/* Checklist Progress */}
            <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Checklist
              </p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{completedChecklist}/{totalChecklist}</p>
                <Progress value={progress} className="flex-1 h-2" />
              </div>
            </div>
          </div>

          {/* Notes Preview */}
          {project.notes.currentPhaseComment && (
            <div className="px-5 pb-5">
              <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground italic border-l-4 border-primary/30">
                "{project.notes.currentPhaseComment}"
              </div>
            </div>
          )}
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
