import { useState } from "react";
import { Project, calculateTimeByParty, formatDuration } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Pencil,
  TrendingUp,
  Users,
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
  const { acceptProject, transferProject, toggleResponsibility, updateProject } = useProjects();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const completedChecklist = project.checklist.filter((c) => c.completed).length;
  const totalChecklist = project.checklist.length;
  const timeByParty = calculateTimeByParty(project.responsibilityLog);
  const isGoKwik = project.currentResponsibility === "gokwik";

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

  const handleResponsibilityToggle = () => {
    const newParty = isGoKwik ? "merchant" : "gokwik";
    toggleResponsibility(project.id, newParty);
    toast.success(`Action now pending on ${newParty === "gokwik" ? "GoKwik" : "Merchant"}`);
  };

  const handleSaveEdit = (updatedProject: Project) => {
    updateProject(updatedProject);
    toast.success("Project updated successfully");
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
              {/* Responsibility Toggle - Compact */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5">
                  <Building2 className={`h-3.5 w-3.5 ${isGoKwik ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-medium ${isGoKwik ? "text-primary" : "text-muted-foreground"}`}>
                    GoKwik
                  </span>
                </div>
                <Switch
                  checked={!isGoKwik}
                  onCheckedChange={handleResponsibilityToggle}
                  className="scale-75"
                />
                <div className="flex items-center gap-1.5">
                  <Users className={`h-3.5 w-3.5 ${!isGoKwik ? "text-amber-600" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-medium ${!isGoKwik ? "text-amber-600" : "text-muted-foreground"}`}>
                    Merchant
                  </span>
                </div>
              </div>

              {/* Time Stats */}
              <div className="hidden lg:flex items-center gap-3 text-xs border-l pl-3">
                <div className="flex items-center gap-1 text-primary">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">{formatDuration(timeByParty.gokwik)}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-600">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">{formatDuration(timeByParty.merchant)}</span>
                </div>
              </div>

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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Project
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

          {/* Mobile Responsibility Toggle */}
          <div className="mt-3 pt-3 border-t md:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Action pending on:</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isGoKwik ? "text-primary" : "text-muted-foreground"}`}>
                  GoKwik
                </span>
                <Switch
                  checked={!isGoKwik}
                  onCheckedChange={handleResponsibilityToggle}
                  className="scale-75"
                />
                <span className={`text-xs font-medium ${!isGoKwik ? "text-amber-600" : "text-muted-foreground"}`}>
                  Merchant
                </span>
              </div>
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
        onResponsibilityToggle={toggleResponsibility}
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
    </>
  );
};
