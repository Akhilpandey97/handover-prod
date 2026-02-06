import { useState } from "react";
import { Project, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration } from "@/data/projectsData";
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
  const { acceptProject, transferProject, updateProject } = useProjects();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Calculate checklist per team
  const mintChecklist = project.checklist.filter(c => c.ownerTeam === "mint");
  const integrationChecklist = project.checklist.filter(c => c.ownerTeam === "integration");
  const msChecklist = project.checklist.filter(c => c.ownerTeam === "ms");
  
  const mintCompleted = mintChecklist.filter(c => c.completed).length;
  const integrationCompleted = integrationChecklist.filter(c => c.completed).length;
  const msCompleted = msChecklist.filter(c => c.completed).length;
  
  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const phaseStyle = phaseConfig[project.currentPhase];

  const canTransfer = currentUser?.team === project.currentOwnerTeam && 
    !project.pendingAcceptance && 
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";

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
                      <span className="text-xs opacity-70">•</span>
                      <span className="text-xs font-mono opacity-70">{project.mid}</span>
                      {project.links.brandUrl && (
                        <>
                          <span className="text-xs opacity-70">•</span>
                          <a 
                            href={project.links.brandUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors text-xs"
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
              <div className="grid grid-cols-5 gap-4">
                {/* ARR */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    ARR
                  </div>
                  <p className="text-lg font-bold">{project.arr} Cr</p>
                </div>

                {/* Go-Live % */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Go-Live
                  </div>
                  <p className="text-lg font-bold">{project.goLivePercent}%</p>
                </div>

                {/* Pending With */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Pending With</div>
                  <div className={`flex items-center gap-1.5 font-semibold ${responsibility.color} px-2 py-0.5 rounded-md w-fit`}>
                    <responsibility.icon className="h-4 w-4" />
                    <span className="text-sm">{responsibility.label}</span>
                  </div>
                </div>

                {/* Time Tracked */}
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50">
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
                <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Checklist
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-blue-600 dark:text-blue-400" title="MINT">{mintCompleted}/{mintChecklist.length}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-purple-600 dark:text-purple-400" title="Integration">{integrationCompleted}/{integrationChecklist.length}</span>
                    {msChecklist.length > 0 && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-emerald-600 dark:text-emerald-400" title="MS">{msCompleted}/{msChecklist.length}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="w-56 border-l border-border/50 bg-background/40 p-4 flex flex-col justify-between">
              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9"
                  onClick={() => setDetailsOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  View Details
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9"
                  onClick={() => setChecklistOpen(true)}
                >
                  <ClipboardList className="h-4 w-4" />
                  Open Checklist
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Project
                </Button>
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
                    variant="outline"
                    onClick={() => setTransferOpen(true)} 
                    className="w-full gap-2"
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
    </>
  );
};
