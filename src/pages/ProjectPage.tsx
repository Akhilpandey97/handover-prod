import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { useCustomFields, useCustomFieldValues } from "@/hooks/useCustomFields";
import { CustomFieldsDisplay } from "@/components/CustomFieldsRenderer";
import { Project, ProjectState, projectStateLabels, projectStateColors, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration } from "@/data/projectsData";
import { ChecklistDialog } from "@/components/ChecklistDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { AssignOwnerDialog } from "@/components/AssignOwnerDialog";
import { ProjectDetailsDialog } from "@/components/ProjectDetailsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Building2, Calendar, CheckCircle2, Clock, ClipboardList, DollarSign, ExternalLink, FileText, Globe, Link2, MapPin, Pencil, Trash2, TrendingUp, User, UserPlus, Users, Minus, Activity,
} from "lucide-react";

const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser, isLoading: authLoading } = useAuth();
  const { projects, isLoading: projectsLoading, updateProject, deleteProject } = useProjects();
  const { getLabel, teamLabels, responsibilityLabels, stateLabels } = useLabels();
  const { fields: customFields } = useCustomFields();
  const { values: customValues } = useCustomFieldValues(id);

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view this project.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-lg font-semibold">Project not found</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Go to Dashboard
        </Button>
      </div>
    );
  }

  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);
  const mintChecklist = project.checklist.filter(c => c.ownerTeam === "mint");
  const integrationChecklist = project.checklist.filter(c => c.ownerTeam === "integration");
  const mintCompleted = mintChecklist.filter(c => c.completed).length;
  const integrationCompleted = integrationChecklist.filter(c => c.completed).length;
  const totalCompleted = project.checklist.filter(c => c.completed).length;
  const totalChecklist = project.checklist.length;

  const handleStateChange = (newState: ProjectState) => {
    updateProject({ ...project, projectState: newState });
    toast.success("State updated");
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setDeleteConfirmOpen(false);
    toast.success("Project deleted");
    window.close();
  };

  const handleSaveEdit = (updatedProject: Project) => {
    updateProject(updatedProject);
    toast.success("Project updated");
  };

  // Build activity timeline from transfer history + checklist completions
  const activityTimeline = useMemo(() => {
    const activities: { date: string; type: string; description: string; by?: string }[] = [];

    project.transferHistory.forEach(t => {
      activities.push({
        date: t.transferredAt,
        type: "transfer",
        description: `Transferred from ${teamLabels[t.fromTeam] || t.fromTeam} to ${teamLabels[t.toTeam] || t.toTeam}`,
        by: t.transferredBy,
      });
      if (t.acceptedAt && t.acceptedBy) {
        activities.push({
          date: t.acceptedAt,
          type: "accept",
          description: `Accepted by ${teamLabels[t.toTeam] || t.toTeam}`,
          by: t.acceptedBy,
        });
      }
      if (t.notes?.startsWith("REJECTED:")) {
        activities.push({
          date: t.transferredAt,
          type: "reject",
          description: `Rejected: ${t.notes.replace("REJECTED:", "").trim()}`,
          by: t.transferredBy,
        });
      }
    });

    project.checklist.forEach(c => {
      if (c.completed && c.completedAt) {
        activities.push({
          date: c.completedAt,
          type: "checklist",
          description: `Completed: "${c.title}"`,
          by: c.completedBy,
        });
      }
      if (c.commentAt && c.commentBy) {
        activities.push({
          date: c.commentAt,
          type: "comment",
          description: `Comment on "${c.title}": ${c.comment?.substring(0, 80) || ""}`,
          by: c.commentBy,
        });
      }
      // Responsibility changes
      c.responsibilityLog.forEach((log, idx) => {
        if (idx > 0) {
          activities.push({
            date: log.startedAt,
            type: "responsibility",
            description: `"${c.title}" responsibility changed to ${responsibilityLabels[log.party] || log.party}`,
          });
        }
      });
    });

    project.responsibilityLog.forEach((log, idx) => {
      if (idx > 0) {
        activities.push({
          date: log.startedAt,
          type: "responsibility",
          description: `Project responsibility changed to ${responsibilityLabels[log.party] || log.party} (Phase: ${teamLabels[log.phase] || log.phase})`,
        });
      }
    });

    return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [project, teamLabels, responsibilityLabels]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "transfer": return <ArrowLeft className="h-3.5 w-3.5 text-blue-500" />;
      case "accept": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "reject": return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
      case "checklist": return <ClipboardList className="h-3.5 w-3.5 text-purple-500" />;
      case "comment": return <FileText className="h-3.5 w-3.5 text-amber-500" />;
      case "responsibility": return <Users className="h-3.5 w-3.5 text-cyan-500" />;
      default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const responsibilityDisplay = computedResponsibility === "gokwik"
    ? { label: responsibilityLabels.gokwik, icon: Building2, color: "text-primary bg-primary/10" }
    : computedResponsibility === "merchant"
    ? { label: responsibilityLabels.merchant, icon: Users, color: "text-amber-600 bg-amber-500/10" }
    : { label: responsibilityLabels.neutral, icon: Clock, color: "text-muted-foreground bg-muted" };

  const DetailRow = ({ icon: Icon, label, value, isLink }: { icon: any; label: string; value?: string; isLink?: boolean }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLink && value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
            Open Link <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-sm font-medium truncate">{value || "—"}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b bg-background/90 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="font-bold text-lg">{project.merchantName}</h1>
          <Badge variant="outline" className="font-mono text-xs">{project.mid}</Badge>
          <Badge className={projectStateColors[project.projectState]}>
            {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Action Bar */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setDetailsOpen(true)}>
            <FileText className="h-4 w-4" />View Details
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setChecklistOpen(true)}>
            <ClipboardList className="h-4 w-4" />Open Checklist
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />Edit Project
          </Button>
          {(currentUser?.team === "manager" || currentUser?.team === "super_admin") && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-4 w-4" />Assign Owner
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" />Delete
              </Button>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">State:</span>
            <Select value={project.projectState} onValueChange={(v) => handleStateChange(v as ProjectState)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(projectStateLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{stateLabels[key] || label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />{getLabel("field_arr")}
                  </div>
                  <p className="text-xl font-bold">{project.arr} Cr</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Pending With</div>
                  <div className={`flex items-center gap-1.5 font-semibold ${responsibilityDisplay.color} px-2 py-1 rounded-md w-fit`}>
                    <responsibilityDisplay.icon className="h-4 w-4" />
                    <span>{responsibilityDisplay.label}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" />Time
                  </div>
                  <div className="flex items-center gap-1.5 text-lg font-bold">
                    <span className="text-primary">{formatDuration(timeByParty.gokwik)}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-amber-500">{formatDuration(timeByParty.merchant)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />Checklist
                  </div>
                  <div className="text-sm font-semibold space-y-0.5">
                    <div className="text-blue-600">{mintCompleted}/{mintChecklist.length} {teamLabels.mint}</div>
                    <div className="text-purple-600">{integrationCompleted}/{integrationChecklist.length} {teamLabels.integration}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Project Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-4">
                    <DetailRow icon={Globe} label={getLabel("field_platform")} value={project.platform} />
                    <DetailRow icon={Building2} label={getLabel("field_category")} value={project.category} />
                    <DetailRow icon={User} label={getLabel("field_sales_spoc")} value={project.salesSpoc} />
                    <DetailRow icon={TrendingUp} label={getLabel("field_integration_type")} value={project.integrationType} />
                    <DetailRow icon={Building2} label={getLabel("field_pg_onboarding")} value={project.pgOnboarding} />
                    <DetailRow icon={User} label="Assigned Owner" value={project.assignedOwnerName || "Unassigned"} />
                    <DetailRow icon={User} label="Current Team" value={teamLabels[project.currentOwnerTeam]} />
                    <DetailRow icon={DollarSign} label={getLabel("field_txns_per_day")} value={String(project.txnsPerDay)} />
                    <DetailRow icon={DollarSign} label={getLabel("field_aov")} value={`₹${project.aov.toLocaleString()}`} />
                    <DetailRow icon={TrendingUp} label={getLabel("field_go_live_percent")} value={`${project.goLivePercent}%`} />
                  </div>
                </CardContent>
              </Card>

              {/* Dates & Links */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />Dates & Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-4">
                    <DetailRow icon={Calendar} label={getLabel("field_kick_off_date")} value={project.dates.kickOffDate ? format(new Date(project.dates.kickOffDate), "dd MMM yyyy") : "—"} />
                    <DetailRow icon={Calendar} label={getLabel("field_expected_go_live_date")} value={project.dates.expectedGoLiveDate ? format(new Date(project.dates.expectedGoLiveDate), "dd MMM yyyy") : "TBD"} />
                    <DetailRow icon={Calendar} label={getLabel("field_actual_go_live_date")} value={project.dates.goLiveDate ? format(new Date(project.dates.goLiveDate), "dd MMM yyyy") : "TBD"} />
                  </div>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-2 gap-x-4">
                    <DetailRow icon={Globe} label={getLabel("field_brand_url")} value={project.links.brandUrl} isLink />
                    <DetailRow icon={Link2} label={getLabel("field_jira_link")} value={project.links.jiraLink} isLink />
                    <DetailRow icon={Link2} label={getLabel("field_brd_link")} value={project.links.brdLink} isLink />
                    <DetailRow icon={Link2} label={getLabel("field_mint_checklist_link")} value={project.links.mintChecklistLink} isLink />
                    <DetailRow icon={Link2} label={getLabel("field_integration_checklist_link")} value={project.links.integrationChecklistLink} isLink />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <CustomFieldsDisplay fields={customFields} values={customValues} />
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {(project.notes.mintNotes || project.notes.projectNotes || project.notes.currentPhaseComment || project.notes.phase2Comment) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.notes.mintNotes && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">{getLabel("field_mint_notes")}</p>
                      <p className="text-sm">{project.notes.mintNotes}</p>
                    </div>
                  )}
                  {project.notes.projectNotes && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{getLabel("field_project_notes")}</p>
                      <p className="text-sm">{project.notes.projectNotes}</p>
                    </div>
                  )}
                  {project.notes.currentPhaseComment && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{getLabel("field_current_phase_comment")}</p>
                      <p className="text-sm whitespace-pre-wrap">{project.notes.currentPhaseComment}</p>
                    </div>
                  )}
                  {project.notes.phase2Comment && (
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-1">{getLabel("field_phase2_comment")}</p>
                      <p className="text-sm whitespace-pre-wrap">{project.notes.phase2Comment}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Checklist Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />Checklist Summary ({totalCompleted}/{totalChecklist})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setChecklistOpen(true)}>Open Full Checklist</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {project.checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1 text-sm">
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <span className={item.completed ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">{teamLabels[item.ownerTeam]}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity History Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />Activity History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-0">
                    {activityTimeline.map((activity, idx) => (
                      <div key={idx} className="relative pl-8 py-3 border-l-2 border-muted ml-3">
                        <div className="absolute left-[-9px] top-3.5 h-4 w-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div>
                          <p className="text-sm">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.date), "dd MMM yyyy, HH:mm")}
                            </span>
                            {activity.by && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{activity.by}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ProjectDetailsDialog project={project} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <ChecklistDialog project={project} open={checklistOpen} onOpenChange={setChecklistOpen} />
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onSave={handleSaveEdit} />
      <AssignOwnerDialog project={project} open={assignOpen} onOpenChange={setAssignOpen} />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{project.merchantName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectPage;
