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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  Brain,
  ListChecks,
  Loader2,
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
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<"insights" | "summary">("insights");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

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

  const handleAiAction = async (type: "insights" | "summary") => {
    setAiDialogType(type);
    setAiDialogOpen(true);
    setAiLoading(true);
    setAiResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-project-insights", {
        body: { project, type },
      });
      if (error) throw error;
      setAiResult(data.result);
    } catch (err: any) {
      setAiResult("Failed to generate AI insights. Please try again.");
    } finally {
      setAiLoading(false);
    }
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
          {/* AI Action Bar */}
          <div className="flex items-center gap-2 px-5 pt-3 pb-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 border-violet-200/60 dark:border-violet-800/40 text-violet-700 dark:text-violet-300"
              onClick={() => handleAiAction("insights")}
            >
              <Brain className="h-3 w-3" />
              AI Project Insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 bg-gradient-to-r from-cyan-50 to-sky-50 hover:from-cyan-100 hover:to-sky-100 dark:from-cyan-950/40 dark:to-sky-950/40 border-cyan-200/60 dark:border-cyan-800/40 text-cyan-700 dark:text-cyan-300"
              onClick={() => handleAiAction("summary")}
            >
              <ListChecks className="h-3 w-3" />
              AI Task Summary
            </Button>
          </div>

          <div className="flex items-stretch">
            {/* Left Section - Main Info */}
            <div className="flex-1 p-5 pt-3">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg leading-tight">{project.merchantName}</h3>
                      {isPending && (
                        <Badge className="bg-amber-500 text-white animate-pulse px-2 py-0.5 text-xs font-semibold">
                          <Sparkles className="h-3 w-3 mr-1" />
                          NEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge className={`${phaseStyle.badge} text-white text-[10px] px-2 py-0.5`}>
                        {project.currentPhase.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-mono bg-muted/50">
                        {project.mid}
                      </Badge>
                      {project.assignedOwnerName && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50">
                          <User className="h-2.5 w-2.5 mr-1" />
                          {project.assignedOwnerName}
                        </Badge>
                      )}
                      {project.links.brandUrl && (
                        <a 
                          href={project.links.brandUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50 hover:bg-muted cursor-pointer">
                            <ExternalLink className="h-2.5 w-2.5 mr-1" />
                            Website
                          </Badge>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {/* ARR */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <TrendingUp className="h-3 w-3" />
                    ARR
                  </div>
                  <p className="text-sm font-bold">{project.arr} Cr</p>
                </div>

                {/* Pending With */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Pending With</div>
                  <div className={`flex items-center gap-1 font-semibold ${responsibility.color} px-1.5 py-0.5 rounded-md w-fit`}>
                    <responsibility.icon className="h-3.5 w-3.5" />
                    <span className="text-sm">{responsibility.label}</span>
                  </div>
                </div>

                {/* Time Tracked */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <Clock className="h-3 w-3" />
                    Time
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <span className="text-primary">{formatDuration(timeByParty.gokwik)}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-amber-500">{formatDuration(timeByParty.merchant)}</span>
                  </div>
                </div>

                {/* Checklist Team-wise */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <ClipboardList className="h-3 w-3" />
                    Checklist
                  </div>
                  <div className="flex flex-col gap-0 text-xs font-semibold">
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

              {/* Info Row */}
              <div className="grid grid-cols-4 gap-2">
                {/* Kick Off Date */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <Calendar className="h-3 w-3" />
                    Kick Off
                  </div>
                  <p className="text-sm font-semibold">{project.dates.kickOffDate || "—"}</p>
                </div>

                {/* Go Live Date */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <Calendar className="h-3 w-3" />
                    Go Live
                  </div>
                  <p className="text-sm font-semibold">{project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—"}</p>
                </div>

                {/* Project Phase */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <Activity className="h-3 w-3" />
                    Project Phase
                  </div>
                  <p className="text-sm font-semibold truncate" title={projectPhaseDisplay}>{projectPhaseDisplay}</p>
                </div>

                {/* Project State */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                    <Activity className="h-3 w-3" />
                    Project State
                  </div>
                  <Select value={project.projectState} onValueChange={(val) => handleStateChange(val as ProjectState)}>
                    <SelectTrigger className="h-6 text-sm font-semibold border-0 p-0 shadow-none focus:ring-0 bg-transparent">
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
            <div className="w-48 border-l border-border/50 bg-background/40 p-3 flex flex-col">
              {/* Action Buttons */}
              <div className="space-y-1.5 flex-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-8 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 text-xs"
                  onClick={() => setDetailsOpen(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Details
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-8 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-xs"
                  onClick={() => setChecklistOpen(true)}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Open Checklist
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-8 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Project
                </Button>
                {currentUser?.team === "manager" && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start gap-2 h-8 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-900/40 border border-teal-200/60 dark:border-teal-800/40 text-teal-700 dark:text-teal-300 text-xs"
                      onClick={() => setAssignOpen(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign Owner
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start gap-2 h-8 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </>
                )}
              </div>

              {/* Transfer/Accept - always at bottom */}
              <div className="pt-2 border-t border-border/50 mt-2">
                {isPending ? (
                  <Button 
                    onClick={handleAccept} 
                    className="w-full gap-2 h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accept
                  </Button>
                ) : canTransfer ? (
                  <Button 
                    variant="ghost"
                    onClick={() => setTransferOpen(true)} 
                    disabled={!isTransferReady}
                    className={`w-full gap-2 h-8 border border-border/50 text-xs ${
                      isTransferReady 
                        ? "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300" 
                        : "bg-muted/30 opacity-50 cursor-not-allowed"
                    }`}
                    title={!allCurrentTeamChecklistCompleted ? "Complete all checklist items before transferring" : ""}
                  >
                    Transfer
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {aiDialogType === "insights" ? (
                <><Brain className="h-5 w-5 text-violet-600" /> AI Project Insights</>
              ) : (
                <><ListChecks className="h-5 w-5 text-cyan-600" /> AI Task Summary</>
              )}
              <span className="text-sm font-normal text-muted-foreground">— {project.merchantName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {aiLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {aiResult}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
