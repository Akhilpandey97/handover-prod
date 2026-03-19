import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import {
  Project,
  ProjectState,
  calculateProjectResponsibilityFromChecklist,
  calculateTimeFromChecklist,
  formatDuration,
  projectStateLabels,
} from "@/data/projectsData";
import { LoginScreen } from "@/components/LoginScreen";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { AssignOwnerDialog } from "@/components/AssignOwnerDialog";
import { TransferDialog } from "@/components/TransferDialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hexToRgba } from "@/utils/colorUtils";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe,
  Layers3,
  NotebookPen,
  Target,
  Timer,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceChecklistPanel } from "@/components/project-workspace/WorkspaceChecklistPanel";
import { WorkspaceMetricCard } from "@/components/project-workspace/WorkspaceMetricCard";
import { WorkspaceSection } from "@/components/project-workspace/WorkspaceSection";
import { WorkspaceActivityTimeline } from "@/components/project-workspace/WorkspaceActivityTimeline";

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { projects, updateProject, deleteProject, transferProject } = useProjects();
  const { labels, teamLabels, responsibilityLabels, getLabel, stateLabels, phaseLabels } = useLabels();

  const [activeTab, setActiveTab] = useState("activity");
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
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
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              This project could not be found in your current workspace.
            </p>
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
  const workspaceMainBackground = labels.color_workspace_main_bg || "#f8fbff";
  const workspaceMainBorder = labels.color_workspace_main_border || "#d9e4f2";
  const workspaceMetricBackground = labels.color_workspace_metric_bg || "#ffffff";
  const workspaceMetricBorder = labels.color_workspace_metric_border || "#dce4ee";
  const sectionBorder = labels.color_workspace_section_border || "#dbe5ef";

  const currentTeamChecklist = project.checklist.filter((item) => item.ownerTeam === project.currentOwnerTeam);
  const allCurrentTeamChecklistCompleted = currentTeamChecklist.length > 0 && currentTeamChecklist.every((item) => item.completed);
  const canTransfer =
    currentUser?.team === project.currentOwnerTeam &&
    !project.pendingAcceptance &&
    project.currentPhase !== "completed" &&
    project.currentOwnerTeam !== "ms" &&
    currentUser?.team !== "manager";
  const isTransferReady = canTransfer && allCurrentTeamChecklistCompleted;

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

  const summaryDetails = [
    { label: "Assigned owner", value: project.assignedOwnerName || "Unassigned", icon: <BadgeCheck className="h-4 w-4" /> },
    { label: "Current team", value: teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam, icon: <Building2 className="h-4 w-4" /> },
    { label: "Current phase", value: phaseLabels[project.currentPhase] || project.currentPhase, icon: <Layers3 className="h-4 w-4" /> },
    { label: "Action pending on", value: responsibilityLabels[pendingOn] || pendingOn, icon: <Target className="h-4 w-4" /> },
    { label: "Kick-off", value: project.dates.kickOffDate || "—", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Expected go-live", value: project.dates.expectedGoLiveDate || "—", icon: <CalendarDays className="h-4 w-4" /> },
  ];

  const actionTabs = [
    { value: "activity", label: "Activity", icon: <Activity className="h-4 w-4" /> },
    { value: "details", label: "Project Details", icon: <FileText className="h-4 w-4" /> },
    { value: "checklist", label: "Checklist", icon: <ClipboardList className="h-4 w-4" /> },
    { value: "notes", label: "Notes", icon: <NotebookPen className="h-4 w-4" /> },
  ];

  const externalActions = [
    project.links.brandUrl
      ? { key: "website", label: "Website", href: project.links.brandUrl, icon: <Globe className="h-4 w-4" /> }
      : null,
    project.links.jiraLink
      ? { key: "jira", label: "JIRA", href: project.links.jiraLink, icon: <ExternalLink className="h-4 w-4" /> }
      : null,
    project.links.brdLink
      ? { key: "brd", label: "BRD", href: project.links.brdLink, icon: <ExternalLink className="h-4 w-4" /> }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string; icon: JSX.Element }>;

  const handleSaveEdit = (updatedProject: typeof project) => {
    updateProject(updatedProject);
    toast.success("Project updated successfully");
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setDeleteConfirmOpen(false);
    toast.success("Project deleted");
  };

  const handleTransfer = (assigneeId: string, assigneeName: string, notes: string) => {
    const nextTeamKey = project.currentOwnerTeam === "mint" ? "integration" : "ms";
    const nextTeam = teamLabels[nextTeamKey] || nextTeamKey;
    const transferNote = notes || `Transferred to ${nextTeam} team`;
    transferProject(project.id, `${transferNote} (Assigned to: ${assigneeName})`, assigneeId);
    toast.success(`Transferred ${project.merchantName} to ${assigneeName}`);
  };

  const handleStateChange = (newState: ProjectState) => {
    updateProject({ ...project, projectState: newState });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 lg:px-8 lg:py-6">
        <Button asChild variant="ghost" className="-ml-3 w-fit gap-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section
              className="overflow-hidden rounded-[1.75rem] shadow-[0_24px_70px_-40px_hsl(var(--foreground)/0.18)]"
              style={{
                backgroundColor: hexToRgba(workspaceMainBackground, 0.97),
                border: `1px solid ${hexToRgba(workspaceMainBorder, 0.9)}`,
              }}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem]"
                    style={{
                      backgroundColor: hexToRgba(workspaceMetricBorder, 0.12),
                      border: `1px solid ${hexToRgba(workspaceMetricBorder, 0.58)}`,
                    }}
                  >
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[1.75rem] font-semibold tracking-[-0.05em] text-foreground">
                      {project.merchantName}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">MID {project.mid}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
                      <Badge variant="outline">{phaseLabels[project.currentPhase] || project.currentPhase}</Badge>
                      <Badge variant={project.pendingAcceptance ? "outline" : "default"}>
                        {project.pendingAcceptance
                          ? "Pending acceptance"
                          : stateLabels[project.projectState] || projectStateLabels[project.projectState]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="grid grid-cols-3"
                style={{ borderTop: `1px solid ${hexToRgba(workspaceMainBorder, 0.62)}` }}
              >
                {[
                  { label: "Checklist", value: `${completedChecklist}/${project.checklist.length}` },
                  { label: "Internal", value: formatDuration(timeByParty.gokwik) },
                  { label: "Merchant", value: formatDuration(timeByParty.merchant) },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className="px-3 py-4 text-center"
                    style={{
                      borderLeft: index === 0 ? "none" : `1px solid ${hexToRgba(workspaceMainBorder, 0.58)}`,
                    }}
                  >
                    <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">{item.value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <WorkspaceSection
              title="Project properties"
              description="Operational owner, timing, and execution metadata."
              icon={<Layers3 className="h-5 w-5" />}
            >
              <div className="space-y-3">
                {summaryDetails.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-4 rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: hexToRgba(workspaceMetricBackground, 0.88),
                      border: `1px solid ${hexToRgba(workspaceMetricBorder, 0.72)}`,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <span className="text-primary">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className="text-right text-sm font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </WorkspaceSection>

            <WorkspaceSection
              title="Quick links"
              description="Context links and execution readiness."
              icon={<ArrowUpRight className="h-5 w-5" />}
            >
              <div className="space-y-3">
                {externalActions.length > 0 ? (
                  externalActions.map((action) => (
                    <Button key={action.key} asChild variant="outline" className="h-11 w-full justify-between rounded-2xl px-4">
                      <a href={action.href} target="_blank" rel="noreferrer">
                        <span>{action.label}</span>
                        {action.icon}
                      </a>
                    </Button>
                  ))
                ) : (
                  <div
                    className="rounded-2xl px-4 py-3 text-sm text-muted-foreground"
                    style={{
                      backgroundColor: hexToRgba(workspaceMetricBackground, 0.88),
                      border: `1px solid ${hexToRgba(workspaceMetricBorder, 0.72)}`,
                    }}
                  >
                    No external project links available yet.
                  </div>
                )}

                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: hexToRgba(workspaceMetricBackground, 0.88),
                    border: `1px solid ${hexToRgba(workspaceMetricBorder, 0.72)}`,
                  }}
                >
                  <p className="font-semibold text-foreground">Transfer readiness</p>
                  <p className="mt-1 leading-6 text-muted-foreground">
                    {canTransfer
                      ? isTransferReady
                        ? "This project is ready to be transferred to the next team."
                        : "Complete all checklist items for the current team to unlock transfer."
                      : "Transfer becomes available only for the active owning team during eligible phases."}
                  </p>
                </div>
              </div>
            </WorkspaceSection>
          </aside>

          <section
            className="overflow-hidden rounded-[1.9rem] shadow-[0_28px_90px_-52px_hsl(var(--foreground)/0.2)]"
            style={{
              backgroundColor: hexToRgba(workspaceMainBackground, 0.97),
              border: `1px solid ${hexToRgba(workspaceMainBorder, 0.9)}`,
            }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
              <div className="flex flex-col gap-4 p-5 lg:p-6">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {actionTabs.map((tab) => (
                      <Button
                        key={tab.value}
                        type="button"
                        variant={activeTab === tab.value ? "default" : "outline"}
                        className="h-11 rounded-2xl px-4"
                        onClick={() => setActiveTab(tab.value)}
                      >
                        {tab.icon}
                        {tab.label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <Button variant="outline" className="h-11 rounded-2xl px-4" onClick={() => setEditOpen(true)}>
                      <FileText className="h-4 w-4" />
                      Edit Project
                    </Button>
                    {currentUser?.team === "manager" ? (
                      <Button variant="outline" className="h-11 rounded-2xl px-4" onClick={() => setAssignOpen(true)}>
                        <UserPlus className="h-4 w-4" />
                        Assign Owner
                      </Button>
                    ) : null}
                    {canTransfer ? (
                      <Button
                        variant={isTransferReady ? "default" : "outline"}
                        className="h-11 rounded-2xl px-4"
                        onClick={() => isTransferReady && setTransferOpen(true)}
                        disabled={!isTransferReady}
                      >
                        <ArrowRight className="h-4 w-4" />
                        Transfer Project
                      </Button>
                    ) : null}
                    {currentUser?.team === "manager" ? (
                      <Button variant="destructive" className="h-11 rounded-2xl px-4" onClick={() => setDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div
                  className="flex flex-wrap items-center gap-3 rounded-[1.35rem] px-4 py-3"
                  style={{
                    backgroundColor: hexToRgba(workspaceMetricBackground, 0.88),
                    border: `1px solid ${hexToRgba(workspaceMetricBorder, 0.72)}`,
                  }}
                >
                  <Badge variant="outline" className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Activity type: All
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Time: All time
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {project.transferHistory.length} handoffs tracked
                  </Badge>
                </div>

                <TabsList
                  className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-[1.3rem] p-1"
                  style={{
                    backgroundColor: hexToRgba(workspaceMetricBorder, 0.12),
                    border: `1px solid ${hexToRgba(sectionBorder, 0.6)}`,
                  }}
                >
                  {actionTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="min-w-max rounded-[1rem] px-4 py-2.5 text-sm font-semibold data-[state=active]:shadow-none"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="px-5 pb-5 lg:px-6 lg:pb-6">
                <TabsContent value="activity" className="m-0">
                  <WorkspaceSection
                    title="Activity history"
                    description="Complete audit trail of user actions, system updates, ownership changes, and project milestones."
                    icon={<Activity className="h-5 w-5" />}
                    contentClassName="p-0"
                    className="min-h-[760px]"
                  >
                    <WorkspaceActivityTimeline project={project} />
                  </WorkspaceSection>
                </TabsContent>

                <TabsContent value="details" className="m-0">
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
                </TabsContent>

                <TabsContent value="checklist" className="m-0">
                  <WorkspaceSection
                    title="Checklist"
                    description="Execution summary across teams, with completion and milestone visibility."
                    icon={<ClipboardList className="h-5 w-5" />}
                    contentClassName="space-y-0"
                  >
                    <WorkspaceChecklistPanel
                      groupedChecklist={groupedChecklist}
                      completedChecklist={completedChecklist}
                      totalChecklist={project.checklist.length}
                      currentPhase={phaseLabels[project.currentPhase] || project.currentPhase}
                    />
                  </WorkspaceSection>
                </TabsContent>

                <TabsContent value="notes" className="m-0">
                  <WorkspaceSection
                    title="Operational notes"
                    description="High-signal narrative context captured during execution."
                    icon={<NotebookPen className="h-5 w-5" />}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <WorkspaceMetricCard
                        label="Current phase comment"
                        value={project.notes.currentPhaseComment || "No current phase comment added."}
                        eyebrow="Active"
                      />
                      <WorkspaceMetricCard
                        label="Project notes"
                        value={project.notes.projectNotes || "No project notes added."}
                        eyebrow="Context"
                      />
                      <WorkspaceMetricCard
                        label="MINT notes"
                        value={project.notes.mintNotes || "No MINT notes added."}
                        eyebrow="Presales"
                      />
                      <WorkspaceMetricCard
                        label="Phase 2 comment"
                        value={project.notes.phase2Comment || "No phase 2 comment added."}
                        eyebrow="Future"
                      />
                    </div>
                  </WorkspaceSection>
                </TabsContent>
              </div>
            </Tabs>
          </section>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} onSave={handleSaveEdit} />
      <AssignOwnerDialog project={project} open={assignOpen} onOpenChange={setAssignOpen} />
      <TransferDialog
        project={project}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onTransfer={handleTransfer}
      />

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
