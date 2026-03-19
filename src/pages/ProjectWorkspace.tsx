import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import {
  Project,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateLabels,
} from "@/data/projectsData";
import { LoginScreen } from "@/components/LoginScreen";
import { ProjectDetailsDialog } from "@/components/ProjectDetailsDialog";
import { ChecklistDialog } from "@/components/ChecklistDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { AssignOwnerDialog } from "@/components/AssignOwnerDialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Layers3,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

const DetailTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm font-semibold text-foreground">{value || "—"}</p>
  </div>
);

const ChecklistRow = ({ title, done }: { title: string; done: boolean }) => (
  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
    <span className="text-sm font-medium text-foreground">{title}</span>
    <Badge variant={done ? "default" : "outline"}>{done ? "Done" : "Pending"}</Badge>
  </div>
);

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { projects, updateProject, deleteProject } = useProjects();
  const { teamLabels, responsibilityLabels, getLabel, stateLabels } = useLabels();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const project = projects.find((entry) => entry.id === projectId) ?? null;

  const groupedChecklist = useMemo(() => {
    if (!project) return [] as Array<{ team: string; items: Project["checklist"] }>;

    const groups = project.checklist.reduce((acc, item) => {
      const key = item.ownerTeam;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, Project["checklist"]>);

    return Object.entries(groups).map(([team, items]) => ({ team, items }));
  }, [project]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
            <CardDescription>This project could not be found in your current workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedChecklist = project.checklist.filter((item) => item.completed).length;
  const pendingOn = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);

  const handleSaveEdit = (updatedProject: typeof project) => {
    updateProject(updatedProject);
    toast.success("Project updated successfully");
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setDeleteConfirmOpen(false);
    toast.success("Project deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-6 py-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <Button asChild variant="ghost" className="-ml-3 w-fit gap-2 text-muted-foreground">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{project.merchantName}</h1>
                    <Badge variant="outline">MID {project.mid}</Badge>
                    <Badge variant="secondary">{teamLabels[project.currentOwnerTeam]}</Badge>
                    <Badge variant={project.pendingAcceptance ? "outline" : "default"}>
                      {project.pendingAcceptance ? "Pending acceptance" : stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                    </Badge>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    Dedicated project workspace with operational details, checklist progress, and execution actions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {project.links.brandUrl && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={project.links.brandUrl} target="_blank" rel="noreferrer">
                    Website
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={() => setDetailsOpen(true)}>
                View Details
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setChecklistOpen(true)}>
                Open Checklist
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
                Edit Project
              </Button>
              {currentUser?.team === "manager" && (
                <>
                  <Button variant="outline" className="gap-2" onClick={() => setAssignOpen(true)}>
                    <UserPlus className="h-4 w-4" />
                    Assign Owner
                  </Button>
                  <Button variant="destructive" className="gap-2" onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
            <DetailTile label="Current team" value={teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam} />
            <DetailTile label="Assigned owner" value={project.assignedOwnerName || "Unassigned"} />
            <DetailTile label="Action pending on" value={responsibilityLabels[pendingOn] || pendingOn} />
            <DetailTile label="Checklist progress" value={`${completedChecklist}/${project.checklist.length} done`} />
            <DetailTile label="Internal time" value={formatDuration(timeByParty.gokwik)} />
            <DetailTile label="Merchant time" value={formatDuration(timeByParty.merchant)} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              Project details
            </CardTitle>
            <CardDescription>Enterprise snapshot for leadership, delivery, and operations review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailTile label={getLabel("field_platform")} value={project.platform} />
            <DetailTile label={getLabel("field_category")} value={project.category} />
            <DetailTile label={getLabel("field_arr")} value={`${project.arr} Cr`} />
            <DetailTile label={getLabel("field_txns_per_day")} value={`${project.txnsPerDay}`} />
            <DetailTile label={getLabel("field_aov")} value={`₹${project.aov.toLocaleString()}`} />
            <DetailTile label={getLabel("field_sales_spoc")} value={project.salesSpoc} />
            <DetailTile label={getLabel("field_integration_type")} value={project.integrationType} />
            <DetailTile label={getLabel("field_pg_onboarding")} value={project.pgOnboarding} />
            <DetailTile label={getLabel("field_go_live_percent")} value={`${project.goLivePercent}%`} />
            <DetailTile label={getLabel("field_kick_off_date")} value={project.dates.kickOffDate || "—"} />
            <DetailTile label={getLabel("field_expected_go_live_date")} value={project.dates.expectedGoLiveDate || "—"} />
            <DetailTile label={getLabel("field_actual_go_live_date")} value={project.dates.goLiveDate || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Checklist
            </CardTitle>
            <CardDescription>Collapsed execution summary across teams, ready for drill-down.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Total items</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{project.checklist.length}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{completedChecklist}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Last milestone</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{project.currentPhase}</p>
              </div>
            </div>

            <div className="space-y-4">
              {groupedChecklist.map(({ team, items }) => {
                const done = items.filter((item) => item.completed).length;

                return (
                  <div key={team} className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{teamLabels[team as keyof typeof teamLabels] || team}</p>
                        <p className="text-xs text-muted-foreground">{done} of {items.length} completed</p>
                      </div>
                      <Badge variant="outline">{done}/{items.length}</Badge>
                    </div>

                    <div className="space-y-2">
                      {items.map((item) => (
                        <ChecklistRow key={item.id} title={item.title} done={item.completed} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectWorkspace;
