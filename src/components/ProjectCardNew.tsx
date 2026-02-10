import { useState } from "react";
import { Project, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration, projectStateLabels, projectStateColors, ProjectState } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { ChecklistDialog } from "./ChecklistDialog";
import { EditProjectDialog } from "./EditProjectDialog";
import { TransferDialog } from "./TransferDialog";
import { AssignOwnerDialog } from "./AssignOwnerDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Pencil,
  Building2,
  Users,
  ExternalLink,
  TrendingUp,
  FileText,
  ClipboardList,
  Sparkles,
  UserPlus,
  Calendar,
  Activity,
  User,
  Trash2,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

const phaseConfig = {
  mint: { 
    bg: "bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20", 
    border: "border-blue-200/60 dark:border-blue-800/60",
    badge: "bg-blue-500 hover:bg-blue-600",
    accent: "text-blue-600 dark:text-blue-400"
  },
  integration: { 
    bg: "bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20", 
    border: "border-purple-200/60 dark:border-purple-800/60",
    badge: "bg-purple-500 hover:bg-purple-600",
    accent: "text-purple-600 dark:text-purple-400"
  },
  ms: { 
    bg: "bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20", 
    border: "border-emerald-200/60 dark:border-emerald-800/60",
    badge: "bg-emerald-500 hover:bg-emerald-600",
    accent: "text-emerald-600 dark:text-emerald-400"
  },
  completed: { 
    bg: "bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-950/30 dark:to-gray-900/20", 
    border: "border-gray-200/60 dark:border-gray-800/60",
    badge: "bg-gray-500 hover:bg-gray-600",
    accent: "text-gray-600 dark:text-gray-400"
  },
};

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { acceptProject, transferProject, updateProject, deleteProject } = useProjects();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Calculate checklist per team
  const mintChecklist = project.checklist.filter(c => c.ownerTeam === "mint");
  const integrationChecklist = project.checklist.filter(c => c.ownerTeam === "integration");
  
  const mintCompleted = mintChecklist.filter(c => c.completed).length;
  const integrationCompleted = integrationChecklist.filter(c => c.completed).length;
  
  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const phaseStyle = phaseConfig[project.currentPhase];

  // Find next incomplete checklist item title (Project Phase display)
  const nextIncompleteItem = project.checklist.find(c => !c.completed);
  const projectPhaseDisplay = nextIncompleteItem ? nextIncompleteItem.title : "All Complete";

  // Check if all current team's checklist items are completed
  const currentTeamChecklist = project.checklist.filter(c => c.ownerTeam === project.currentOwnerTeam);
  const allCurrentTeamChecklistCompleted = currentTeamChecklist.length > 0 && 
    currentTeamChecklist.every(c => c.completed);

  const canTransfer = currentUser?.team === project.currentOwnerTeam && 
    !project.pendingAcceptance && 
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";

  const isTransferReady = canTransfer && allCurrentTeamChecklistCompleted;

  const isPending = project.pendingAcceptance && currentUser?.team === project.currentOwnerTeam;

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

  const handleDelete = () => {
    deleteProject(project.id);
    setDeleteConfirmOpen(false);
  };

  const handleStateChange = (newState: ProjectState) => {
    updateProject({ ...project, projectState: newState });
  };

  const getResponsibilityDisplay = () => {
    if (computedResponsibility === "gokwik") return { label: "GoKwik", icon: Building2, color: "text-primary bg-primary/10" };
    if (computedResponsibility === "merchant") return { label: "Merchant", icon: Users, color: "text-amber-600 bg-amber-500/10" };
    return { label: "Neutral", icon: Clock, color: "text-muted-foreground bg-muted" };
  };

  const responsibility = getResponsibilityDisplay();

  return (
    <>
      <Card className={`${phaseStyle.bg} ${phaseStyle.border} border hover:shadow-lg transition-all duration-300 overflow-hidden`}>
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Left Section - Main Info */}
            <div className="flex-1 p-5">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{project.merchantName}</h3>
                      {isPending && (
                        <Badge className="bg-amber-500 text-white animate-pulse px-2 py-0.5 text-xs font-semibold">
                          <Sparkles className="h-3 w-3 mr-1" />
                          NEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge className={`${phaseStyle.badge} text-white text-xs px-2 py-0.5`}>
                        {project.currentPhase.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="text-xs text-muted-foreground/70">{project.mid}</span>
                      {project.assignedOwnerName && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <User className="h-3 w-3" />
                            {project.assignedOwnerName}
                          </span>
                        </>
                      )}
                      {project.links.brandUrl && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <a 
                            href={project.links.brandUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors text-xs text-muted-foreground/70 hover:text-muted-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Website
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                {/* ARR */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    ARR
                  </div>
                  <p className="text-lg font-bold">{project.arr} Cr</p>
                </div>

                {/* Pending With */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Pending With</div>
                  <div className={`flex items-center gap-1.5 font-semibold ${responsibility.color} px-2 py-0.5 rounded-md w-fit`}>
                    <responsibility.icon className="h-4 w-4" />
                    <span className="text-sm">{responsibility.label}</span>
                  </div>
                </div>

                {/* Time Tracked */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    Time
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="text-primary">{formatDuration(timeByParty.gokwik)}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-amber-500">{formatDuration(timeByParty.merchant)}</span>
                  </div>
                </div>

                {/* Checklist Team-wise */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Checklist
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs font-semibold">
                    <div className="flex items-center gap-1">
                      <span className="text-blue-600 dark:text-blue-400">{mintCompleted}/{mintChecklist.length}</span>
                      <span className="text-muted-foreground/60 text-[10px]">MINT</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-purple-600 dark:text-purple-400">{integrationCompleted}/{integrationChecklist.length}</span>
                      <span className="text-muted-foreground/60 text-[10px]">Integration</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* New Info Row */}
              <div className="grid grid-cols-4 gap-3">
                {/* Kick Off Date */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <Calendar className="h-3 w-3" />
                    Kick Off
                  </div>
                  <p className="text-xs font-semibold">{project.dates.kickOffDate || "—"}</p>
                </div>

                {/* Go Live Date */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <Calendar className="h-3 w-3" />
                    Go Live
                  </div>
                  <p className="text-xs font-semibold">{project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—"}</p>
                </div>

                {/* Project Phase (next checklist item) */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <Activity className="h-3 w-3" />
                    Current Step
                  </div>
                  <p className="text-xs font-semibold truncate" title={projectPhaseDisplay}>{projectPhaseDisplay}</p>
                </div>

                {/* Project State */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <Activity className="h-3 w-3" />
                    State
                  </div>
                  <Select value={project.projectState} onValueChange={(val) => handleStateChange(val as ProjectState)}>
                    <SelectTrigger className="h-6 text-xs font-semibold border-0 p-0 shadow-none focus:ring-0 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(projectStateLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${projectStateColors[key as ProjectState]}`}>{label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="w-52 border-l border-border/50 bg-background/40 p-4 flex flex-col justify-between">
              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300"
                  onClick={() => setDetailsOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  View Details
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300"
                  onClick={() => setChecklistOpen(true)}
                >
                  <ClipboardList className="h-4 w-4" />
                  Open Checklist
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Project
                </Button>
                {currentUser?.team === "manager" && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start gap-2 h-9 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-900/40 border border-teal-200/60 dark:border-teal-800/40 text-teal-700 dark:text-teal-300"
                      onClick={() => setAssignOpen(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Assign Owner
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start gap-2 h-9 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
              </div>

              {/* Transfer/Accept */}
              <div className="pt-3 border-t border-border/50">
                {isPending ? (
                  <Button 
                    onClick={handleAccept} 
                    className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Accept
                  </Button>
                ) : canTransfer ? (
                  <Button 
                    variant="ghost"
                    onClick={() => setTransferOpen(true)} 
                    disabled={!isTransferReady}
                    className={`w-full gap-2 h-9 border border-border/50 ${
                      isTransferReady 
                        ? "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300" 
                        : "bg-muted/30 opacity-50 cursor-not-allowed"
                    }`}
                    title={!allCurrentTeamChecklistCompleted ? "Complete all checklist items before transferring" : ""}
                  >
                    Transfer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
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
      <AssignOwnerDialog
        project={project}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{project.merchantName}</strong>? This will permanently remove the project and all its checklist items, comments, and history. This action cannot be undone.
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
    </>
  );
};
