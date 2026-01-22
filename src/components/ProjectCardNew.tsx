import { useState } from "react";
import { Project } from "@/data/projectsData";
import { teamLabels, TeamRole } from "@/data/teams";
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
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  TrendingUp,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

const phaseColors = {
  mint: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  integration: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  ms: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject } = useProjects();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const completedChecklist = project.checklist.filter((c) => c.completed).length;
  const totalChecklist = project.checklist.length;

  const canTransfer = currentUser?.team === project.currentOwnerTeam && 
    !project.pendingAcceptance && 
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms";

  const handleAccept = () => {
    acceptProject(project.id);
    toast.success(`Accepted ${project.merchantName}`);
  };

  const handleTransfer = () => {
    const nextTeam = project.currentOwnerTeam === "mint" ? "Integration" : "MS";
    transferProject(project.id, `Transferred to ${nextTeam} team`);
    toast.success(`Transferred ${project.merchantName} to ${nextTeam} team`);
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{project.merchantName}</h3>
                  <p className="text-xs text-muted-foreground">{project.mid}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={phaseColors[project.currentPhase]}>
                  {project.currentPhase.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {project.platform}
                </Badge>
                {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                  <Badge className="bg-amber-500 text-white animate-pulse">
                    Pending Acceptance
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: Metrics & Actions */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Metrics */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-primary">{project.arr} cr</p>
                  <p className="text-xs text-muted-foreground">ARR</p>
                </div>
                <div className="text-center">
                  <p className="font-bold">{project.goLivePercent}%</p>
                  <p className="text-xs text-muted-foreground">Go Live</p>
                </div>
                <div className="text-center">
                  <p className="font-bold">{completedChecklist}/{totalChecklist}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
              </div>

              {/* Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover">
                  <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChecklistOpen(true)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    View Checklist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Accept Button */}
              {project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam && (
                <Button size="sm" onClick={handleAccept} className="gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </Button>
              )}

              {/* Transfer Button */}
              {canTransfer && (
                <Button size="sm" variant="secondary" onClick={handleTransfer} className="gap-1">
                  Transfer
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Transfer History Preview */}
          {project.transferHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>
                  Last transfer: {teamLabels[project.transferHistory[project.transferHistory.length - 1].fromTeam]} →{" "}
                  {teamLabels[project.transferHistory[project.transferHistory.length - 1].toTeam]}
                </span>
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
    </>
  );
};
