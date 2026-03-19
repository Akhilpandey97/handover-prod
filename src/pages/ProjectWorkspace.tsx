import { ReactNode, useMemo, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  ExternalLink,
  Layers3,
  Timer,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceChecklistPanel } from "@/components/project-workspace/WorkspaceChecklistPanel";
import { WorkspaceMetricCard } from "@/components/project-workspace/WorkspaceMetricCard";
import { WorkspaceSection } from "@/components/project-workspace/WorkspaceSection";

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
    if (!project) return [] as Array<{ team: string; label: string; items: Project["checklist"] }>;

    const groups = project.checklist.reduce((acc, item) => {
      const key = item.ownerTeam;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, Project["checklist"]>);

    return Object.entries(groups).map(([team, items]) => ({
      team,
      label: teamLabels[team as keyof typeof teamLabels] || team,
      items,
    }));
  }, [project, teamLabels]);

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

  const actionButtons = [
    project.links.brandUrl
      ? {
          key: "website",
          label: "Website",
          icon: <ExternalLink className="h-4 w-4" />,
          onClick: undefined,
          href: project.links.brandUrl,
        }
      : null,
    { key: "details", label: "View Details", onClick: () => setDetailsOpen(true) },
    { key: "checklist", label: "Open Checklist", onClick: () => setChecklistOpen(true) },
    { key: "edit", label: "Edit Project", onClick: () => setEditOpen(true) },
    ...(currentUser?.team === "manager"
      ? [
          { key: "assign", label: "Assign Owner", icon: <UserPlus className="h-4 w-4" />, onClick: () => setAssignOpen(true) },
          { key: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeleteConfirmOpen(true), variant: "destructive" as const },
        ]
      : []),
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    href?: string;
    variant?: "outline" | "destructive";
  }>;

  const detailCards = [
    { label: "Current team", value: teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam, eyebrow: "Ownership", icon: <Building2 className="h-5 w-5" /> },
    { label: "Assigned owner", value: project.assignedOwnerName || "Unassigned", eyebrow: "Ops" , icon: <BadgeCheck className="h-5 w-5" />},
    { label: "Action pending on", value: responsibilityLabels[pendingOn] || pendingOn, eyebrow: "Execution", icon: <ClipboardList className="h-5 w-5" /> },
    { label: "Checklist progress", value: `${completedChecklist}/${project.checklist.length} done`, eyebrow: "Completion", icon: <Layers3 className="h-5 w-5" /> },
    { label: "Internal time", value: formatDuration(timeByParty.gokwik), eyebrow: "Delivery", icon: <Timer className="h-5 w-5" /> },
    { label: "Merchant time", value: formatDuration(timeByParty.merchant), eyebrow: "External", icon: <Timer className="h-5 w-5" /> },
  ];

  const projectDetails = [
    { label: getLabel("field_platform"), value: project.platform },
    { label: getLabel("field_category"), value: project.category },
    { label: getLabel("field_arr"), value: `${project.arr} Cr` },
    { label: getLabel("field_txns_per_day"), value: `${project.txnsPerDay}` },
    { label: getLabel("field_aov"), value: `₹${project.aov.toLocaleString()}` },
    { label: getLabel("field_sales_spoc"), value: project.salesSpoc },
    { label: getLabel("field_integration_type"), value: project.integrationType },
    { label: getLabel("field_pg_onboarding"), value: project.pgOnboarding },
    { label: getLabel("field_go_live_percent"), value: `${project.goLivePercent}%` },
    { label: getLabel("field_kick_off_date"), value: project.dates.kickOffDate || "—" },
    { label: getLabel("field_expected_go_live_date"), value: project.dates.expectedGoLiveDate || "—" },
    { label: getLabel("field_actual_go_live_date"), value: project.dates.goLiveDate || "—" },
  ];

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
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-5 py-6 lg:px-8 xl:px-10">
        <section className="enterprise-panel overflow-hidden rounded-[2rem] border-border/60">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] lg:p-8">
            <div className="space-y-6">
              <Button asChild variant="ghost" className="-ml-3 w-fit gap-2 text-muted-foreground">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>

              <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] border border-border/60 bg-background text-primary shadow-[0_24px_60px_-36px_hsl(var(--foreground)/0.22)]">
                  <Building2 className="h-9 w-9" />
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-4xl font-semibold tracking-[-0.06em] text-foreground lg:text-5xl">{project.merchantName}</h1>
                      <Badge variant="outline" className="px-3 py-1 text-xs">MID {project.mid}</Badge>
                      <Badge variant="secondary" className="px-3 py-1 text-xs">{teamLabels[project.currentOwnerTeam]}</Badge>
                      <Badge variant={project.pendingAcceptance ? "outline" : "default"} className="px-3 py-1 text-xs">
                        {project.pendingAcceptance ? "Pending acceptance" : stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                      </Badge>
                    </div>
                    <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                      Dedicated project workspace with operational details, checklist progress, and execution actions.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {detailCards.map((item) => (
                      <WorkspaceMetricCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        eyebrow={item.eyebrow}
                        icon={item.icon}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 self-start lg:pl-4">
              {actionButtons.map((action) =>
                action.href ? (
                  <Button key={action.key} asChild variant="outline" className="h-14 justify-between rounded-2xl px-5 text-sm">
                    <a href={action.href} target="_blank" rel="noreferrer">
                      <span>{action.label}</span>
                      {action.icon || <ArrowUpRight className="h-4 w-4" />}
                    </a>
                  </Button>
                ) : (
                  <Button
                    key={action.key}
                    variant={action.variant || "outline"}
                    className="h-14 justify-between rounded-2xl px-5 text-sm"
                    onClick={action.onClick}
                  >
                    <span>{action.label}</span>
                    {action.icon || <ArrowUpRight className="h-4 w-4" />}
                  </Button>
                ),
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <WorkspaceSection
            title="Project details"
            description="Enterprise snapshot for leadership, delivery, and operations review."
            icon={<Layers3 className="h-5 w-5" />}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projectDetails.map((item) => (
                <WorkspaceMetricCard key={item.label} label={item.label} value={item.value || "—"} />
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            title="Checklist"
            description="Collapsed execution summary across teams, ready for drill-down."
            icon={<ClipboardList className="h-5 w-5" />}
            contentClassName="space-y-0"
          >
            <WorkspaceChecklistPanel
              groupedChecklist={groupedChecklist}
              completedChecklist={completedChecklist}
              totalChecklist={project.checklist.length}
              currentPhase={project.currentPhase}
            />
          </WorkspaceSection>
        </div>
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
