import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors, TeamRole } from "@/data/teams";
import { UserManagement } from "./UserManagement";
import { ChecklistManagement } from "./ChecklistManagement";
import { CSVUploadDialog } from "./CSVUploadDialog";
import { AddProjectDialog } from "./AddProjectDialog";
import { AssignOwnerDialog } from "./AssignOwnerDialog";
import { Project, calculateTimeByParty, calculateTimeFromChecklist, formatDuration, projectStateLabels, ProjectState, ProjectPhase } from "@/data/projectsData";
import { supabase } from "@/integrations/supabase/client";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  BarChart3,
  Clock,
  Download,
  FolderKanban,
  LogOut,
  Search,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  Upload,
  Plus,
  Target,
  Timer,
  Settings,
  PieChart,
  Rocket,
  Trash2,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { exportProjectsToCSV } from "@/utils/exportProjects";
import { toast } from "sonner";

// Report components
import { ExecutiveDashboard } from "./reports/ExecutiveDashboard";
import { OperationalReports } from "./reports/OperationalReports";
import { MerchantResponsibility } from "./reports/MerchantResponsibility";
import { TacticalLists } from "./reports/TacticalLists";

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { projects, isLoading, addProject, deleteProject, updateProject } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [kickOffFrom, setKickOffFrom] = useState<string>("");
  const [kickOffTo, setKickOffTo] = useState<string>("");
  const [goLiveFrom, setGoLiveFrom] = useState<string>("");
  const [goLiveTo, setGoLiveTo] = useState<string>("");
  const [reportType, setReportType] = useState<string>("executive");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Bulk selection state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStateDialogOpen, setBulkStateDialogOpen] = useState(false);
  const [bulkStateValue, setBulkStateValue] = useState<ProjectState>("in_progress");

  // Fetch profiles for owner filter
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string; team: string }[]>([]);
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("id, name, team");
      setAllProfiles(data || []);
    };
    fetchProfiles();
  }, []);

  // Calculate project time stats helper - FIXED: uses checklist-level time
  const calculateProjectStats = (project: Project) => {
    const checklistTime = calculateTimeFromChecklist(project.checklist);

    const completedChecklist = project.checklist.filter((c) => c.completed).length;
    const totalChecklist = project.checklist.length;

    return {
      projectTime: checklistTime, // Use checklist-aggregated time as the source of truth
      checklistTime,
      completedChecklist,
      totalChecklist,
      checklistProgress: totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0,
    };
  };

  // Merged Project + Checklist Report
  const projectChecklistReport = useMemo(() => {
    return projects.map((project) => {
      const stats = calculateProjectStats(project);
      const mintTasks = project.checklist.filter(c => c.ownerTeam === "mint");
      const integrationTasks = project.checklist.filter(c => c.ownerTeam === "integration");

      const checklistItems = project.checklist.map((item) => {
        const time = calculateTimeByParty(item.responsibilityLog);
        return {
          id: item.id,
          checklistTitle: item.title,
          team: item.ownerTeam,
          phase: item.phase,
          gokwikTime: time.gokwik,
          merchantTime: time.merchant,
          totalTime: time.gokwik + time.merchant,
          completed: item.completed,
          responsibility: item.currentResponsibility,
        };
      });

      return {
        ...project,
        stats,
        mintCompleted: mintTasks.filter(c => c.completed).length,
        mintTotal: mintTasks.length,
        integrationCompleted: integrationTasks.filter(c => c.completed).length,
        integrationTotal: integrationTasks.length,
        checklistItems,
      };
    }).sort((a, b) =>
      (b.stats.projectTime.gokwik + b.stats.projectTime.merchant) -
      (a.stats.projectTime.gokwik + a.stats.projectTime.merchant)
    );
  }, [projects]);

  // Merged Team + Owner Report
  const teamOwnerReport = useMemo(() => {
    const teams: TeamRole[] = ["mint", "integration", "ms"];
    return teams.map((team) => {
      const teamProjects = projects.filter(p => p.currentOwnerTeam === team);
      let teamGokwikTime = 0;
      let teamMerchantTime = 0;
      let teamCompletedTasks = 0;
      let teamTotalTasks = 0;

      teamProjects.forEach((project) => {
        project.checklist.forEach((item) => {
          if (item.ownerTeam === team) {
            teamTotalTasks++;
            if (item.completed) teamCompletedTasks++;
            const time = calculateTimeByParty(item.responsibilityLog);
            teamGokwikTime += time.gokwik;
            teamMerchantTime += time.merchant;
          }
        });
      });

      const ownerMap = new Map<string, {
        ownerId: string; ownerName: string; totalProjects: number;
        completedTasks: number; totalTasks: number; gokwikTime: number;
        merchantTime: number; projectNames: string[];
      }>();

      teamProjects.forEach((project) => {
        const ownerId = project.assignedOwner || "unassigned";
        const ownerName = project.assignedOwnerName || "Unassigned";
        const existing = ownerMap.get(ownerId) || {
          ownerId, ownerName, totalProjects: 0, completedTasks: 0,
          totalTasks: 0, gokwikTime: 0, merchantTime: 0, projectNames: [],
        };

        existing.totalProjects++;
        existing.projectNames.push(project.merchantName);
        existing.totalTasks += project.checklist.filter(c => c.ownerTeam === team).length;
        existing.completedTasks += project.checklist.filter(c => c.ownerTeam === team && c.completed).length;

        project.checklist.forEach((item) => {
          if (item.ownerTeam === team) {
            const time = calculateTimeByParty(item.responsibilityLog);
            existing.gokwikTime += time.gokwik;
            existing.merchantTime += time.merchant;
          }
        });

        ownerMap.set(ownerId, existing);
      });

      return {
        team,
        teamLabel: teamLabels[team],
        projectCount: teamProjects.length,
        pendingCount: teamProjects.filter(p => p.pendingAcceptance).length,
        completedTasks: teamCompletedTasks,
        totalTasks: teamTotalTasks,
        gokwikTime: teamGokwikTime,
        merchantTime: teamMerchantTime,
        owners: Array.from(ownerMap.values()).sort((a, b) => b.totalProjects - a.totalProjects),
      };
    });
  }, [projects]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId);
      else newSet.add(projectId);
      return newSet;
    });
  };

  const filteredOwners = useMemo(() => {
    if (teamFilter === "all") return allProfiles.filter(p => p.team !== "manager");
    return allProfiles.filter(p => p.team === teamFilter);
  }, [allProfiles, teamFilter]);

  // Bulk selection helpers
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId);
      else newSet.add(projectId);
      return newSet;
    });
  };

  const toggleSelectAll = (projectIds: string[]) => {
    setSelectedProjects(prev => {
      const allSelected = projectIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(projectIds);
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      deleteProject(id);
    }
    setSelectedProjects(new Set());
    setBulkDeleteDialogOpen(false);
    toast.success(`Deleted ${ids.length} project(s)`);
  };

  const handleBulkStateUpdate = async () => {
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      const project = projects.find(p => p.id === id);
      if (project) {
        updateProject({ ...project, projectState: bulkStateValue });
      }
    }
    setSelectedProjects(new Set());
    setBulkStateDialogOpen(false);
    toast.success(`Updated ${ids.length} project(s) to ${projectStateLabels[bulkStateValue]}`);
  };

  if (!currentUser) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter projects with new filters
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === "all" || p.currentOwnerTeam === teamFilter;
    const matchesOwner = ownerFilter === "all" || p.assignedOwner === ownerFilter;
    const matchesPhase = phaseFilter === "all" || p.currentPhase === phaseFilter;
    const matchesState = stateFilter === "all" || p.projectState === stateFilter;
    const matchesKickOffFrom = !kickOffFrom || p.dates.kickOffDate >= kickOffFrom;
    const matchesKickOffTo = !kickOffTo || p.dates.kickOffDate <= kickOffTo;
    const matchesGoLiveFrom = !goLiveFrom || (p.dates.goLiveDate && p.dates.goLiveDate >= goLiveFrom) || (p.dates.expectedGoLiveDate && p.dates.expectedGoLiveDate >= goLiveFrom);
    const matchesGoLiveTo = !goLiveTo || (p.dates.goLiveDate && p.dates.goLiveDate <= goLiveTo) || (p.dates.expectedGoLiveDate && p.dates.expectedGoLiveDate <= goLiveTo);
    return matchesSearch && matchesTeam && matchesOwner && matchesPhase && matchesState && matchesKickOffFrom && matchesKickOffTo && matchesGoLiveFrom && matchesGoLiveTo;
  });

  // Stats - "completed" = live + MS accepted (phase completed or state live with no pending)
  const totalProjects = projects.length;
  const pendingProjects = projects.filter((p) => p.pendingAcceptance).length;
  const completedProjects = projects.filter((p) =>
    p.projectState === "live" && !p.pendingAcceptance && p.currentOwnerTeam === "ms"
  ).length;
  const activeProjects = totalProjects - pendingProjects - completedProjects;

  // Time distribution - use checklist-level aggregation
  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  projects.forEach((p) => {
    const time = calculateTimeFromChecklist(p.checklist);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

  // Pipeline stats for overview
  const totalArr = projects.reduce((s, p) => s + p.arr, 0);
  const liveArr = projects.filter(p => p.projectState === "live").reduce((s, p) => s + p.arr, 0);
  const blockedProjects = projects.filter(p => p.projectState === "blocked").length;
  const onHoldProjects = projects.filter(p => p.projectState === "on_hold").length;

  const handleAddProject = (project: Project) => {
    addProject(project);
    toast.success(`Added ${project.merchantName}`);
  };

  const filteredProjectIds = filteredProjects.map(p => p.id);
  const allFilteredSelected = filteredProjectIds.length > 0 && filteredProjectIds.every(id => selectedProjects.has(id));

  const clearFilters = () => {
    setTeamFilter("all");
    setOwnerFilter("all");
    setPhaseFilter("all");
    setStateFilter("all");
    setKickOffFrom("");
    setKickOffTo("");
    setGoLiveFrom("");
    setGoLiveTo("");
  };

  const hasActiveFilters = teamFilter !== "all" || ownerFilter !== "all" || phaseFilter !== "all" || stateFilter !== "all" || kickOffFrom || kickOffTo || goLiveFrom || goLiveTo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="h-16 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Manager Dashboard</h1>
                <p className="text-xs text-muted-foreground">Project Management Hub</p>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => exportProjectsToCSV(projects)} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export All
              </Button>
              <Button onClick={() => setCsvDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2 shadow-lg">
                <Plus className="h-4 w-4" />
                Add Project
              </Button>
            </div>

            <div className="flex items-center gap-4 pl-4 border-l">
              <div className="text-right hidden md:block">
                <p className="font-medium text-sm">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">Manager</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg">
                {currentUser.name.charAt(0)}
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-12 bg-muted/50 p-1 mb-6">
            <TabsTrigger value="overview" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <PieChart className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <FolderKanban className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <ListChecks className="h-4 w-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* ========= OVERVIEW TAB ========= */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-blue-500/5 border-primary/20 hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Total</p>
                      <p className="text-3xl font-bold">{totalProjects}</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <FolderKanban className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Pipeline ARR: {totalArr.toFixed(2)} Cr</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Pending</p>
                      <p className="text-3xl font-bold text-amber-600">{pendingProjects}</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Awaiting acceptance</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-200/50 dark:border-blue-800/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active</p>
                      <p className="text-3xl font-bold text-blue-600">{activeProjects}</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                      <Rocket className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{blockedProjects} blocked, {onHoldProjects} on hold</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-200/50 dark:border-emerald-800/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Completed</p>
                      <p className="text-3xl font-bold text-emerald-600">{completedProjects}</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Live ARR: {liveArr.toFixed(2)} Cr</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-200/50 dark:border-purple-800/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Avg Go-Live</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.goLivePercent, 0) / projects.length) : 0}%
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                      <Target className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Across all projects</p>
                </CardContent>
              </Card>
            </div>

            {/* Team Performance & Time Distribution */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Team Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {teamOwnerReport.map((team) => {
                      const progress = team.totalTasks > 0 ? Math.round((team.completedTasks / team.totalTasks) * 100) : 0;
                      return (
                        <div key={team.team} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-lg ${teamColors[team.team]} flex items-center justify-center text-white font-bold`}>
                                {team.teamLabel.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold">{team.teamLabel}</p>
                                <p className="text-xs text-muted-foreground">{team.projectCount} projects</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{team.completedTasks}/{team.totalTasks}</p>
                              <p className="text-xs text-muted-foreground">Tasks done</p>
                            </div>
                          </div>
                          <Progress value={progress} className="h-2" />
                          {team.pendingCount > 0 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200">
                              {team.pendingCount} pending acceptance
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    Time Distribution
                  </CardTitle>
                  <CardDescription>Total time tracked across all projects (from checklist items)</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-primary/10 to-blue-500/5 rounded-xl p-6 text-center">
                        <Building2 className="h-8 w-8 mx-auto text-primary mb-3" />
                        <p className="text-3xl font-bold text-primary">{formatDuration(totalGokwikTime)}</p>
                        <p className="text-sm text-muted-foreground mt-1">GoKwik Time</p>
                      </div>
                      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl p-6 text-center">
                        <Users className="h-8 w-8 mx-auto text-amber-500 mb-3" />
                        <p className="text-3xl font-bold text-amber-500">{formatDuration(totalMerchantTime)}</p>
                        <p className="text-sm text-muted-foreground mt-1">Merchant Time</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Distribution</span>
                        <span className="font-medium">
                          {Math.round((totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100)}% / {Math.round((totalMerchantTime / (totalGokwikTime + totalMerchantTime || 1)) * 100)}%
                        </span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        <div className="bg-primary transition-all" style={{ width: `${(totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%` }} />
                        <div className="bg-amber-500 transition-all" style={{ width: `${(totalMerchantTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Phase Distribution & State Distribution */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Phase Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {(["mint", "integration", "ms", "completed"] as ProjectPhase[]).map(phase => {
                      const count = projects.filter(p => p.currentPhase === phase).length;
                      const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                      return (
                        <div key={phase} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize">{phase === "mint" ? "MINT (Presales)" : phase === "ms" ? "Merchant Success" : phase}</span>
                            <span className="font-bold">{count} ({pct}%)</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    State Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {(Object.keys(projectStateLabels) as ProjectState[]).map(state => {
                      const count = projects.filter(p => p.projectState === state).length;
                      const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                      return (
                        <div key={state} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{projectStateLabels[state]}</span>
                            <span className="font-bold">{count} ({pct}%)</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========= PROJECTS TAB ========= */}
          <TabsContent value="projects" className="space-y-6 mt-0">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      All Projects
                    </CardTitle>
                    {selectedProjects.size > 0 && (
                      <Badge variant="secondary" className="text-sm">{selectedProjects.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProjects.size > 0 && (
                      <>
                        <Button variant="outline" className="gap-2" onClick={() => setBulkAssignDialogOpen(true)}>
                          <UserPlus className="h-4 w-4" />
                          Assign ({selectedProjects.size})
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={() => setBulkStateDialogOpen(true)}>
                          <RefreshCw className="h-4 w-4" />
                          Update State ({selectedProjects.size})
                        </Button>
                        <Button variant="destructive" className="gap-2" onClick={() => setBulkDeleteDialogOpen(true)}>
                          <Trash2 className="h-4 w-4" />
                          Delete ({selectedProjects.size})
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {/* Filters */}
                <div className="flex gap-2 flex-wrap mt-3">
                  <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setOwnerFilter("all"); }}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      <SelectItem value="mint">MINT</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="ms">MS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Owner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      {filteredOwners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      <SelectItem value="mint">MINT</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="ms">MS</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {(Object.keys(projectStateLabels) as ProjectState[]).map(s => (
                        <SelectItem key={s} value={s}>{projectStateLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Start:</span>
                    <Input type="date" value={kickOffFrom} onChange={e => setKickOffFrom(e.target.value)} className="w-[130px] h-9 text-xs" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="date" value={kickOffTo} onChange={e => setKickOffTo(e.target.value)} className="w-[130px] h-9 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Go-Live:</span>
                    <Input type="date" value={goLiveFrom} onChange={e => setGoLiveFrom(e.target.value)} className="w-[130px] h-9 text-xs" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="date" value={goLiveTo} onChange={e => setGoLiveTo(e.target.value)} className="w-[130px] h-9 text-xs" />
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">Clear</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
                  <div className="p-6 space-y-4">
                    {filteredProjects.length > 0 && (
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <Checkbox checked={allFilteredSelected} onCheckedChange={() => toggleSelectAll(filteredProjectIds)} />
                        <span className="text-sm text-muted-foreground">Select all ({filteredProjects.length})</span>
                      </div>
                    )}
                    {filteredProjects.length === 0 ? (
                      <div className="text-center py-20">
                        <FolderKanban className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Projects Found</h3>
                        <p className="text-muted-foreground">Try adjusting your filters or add a new project.</p>
                      </div>
                    ) : (
                      filteredProjects.map((project) => (
                        <div key={project.id} className="flex items-start gap-3">
                          <div className="pt-4">
                            <Checkbox checked={selectedProjects.has(project.id)} onCheckedChange={() => toggleProjectSelection(project.id)} />
                          </div>
                          <div className="flex-1">
                            <ProjectCardNew project={project} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========= REPORTS TAB ========= */}
          <TabsContent value="reports" className="space-y-6 mt-0">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Reports
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: "executive", label: "Executive" },
                      { key: "operational", label: "Operational" },
                      { key: "merchant", label: "Merchant" },
                      { key: "tactical", label: "Tactical" },
                      { key: "project", label: "Project & Checklist" },
                      { key: "team", label: "Team & Owner" },
                    ].map(({ key, label }) => (
                      <Button key={key} variant={reportType === key ? "default" : "outline"} size="sm" onClick={() => setReportType(key)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-320px)] min-h-[500px]">
                  <div className="p-6">
                    {reportType === "executive" && <ExecutiveDashboard projects={projects} />}
                    {reportType === "operational" && <OperationalReports projects={projects} />}
                    {reportType === "merchant" && <MerchantResponsibility projects={projects} />}
                    {reportType === "tactical" && <TacticalLists projects={projects} />}

                    {/* Merged Project + Checklist Report */}
                    {reportType === "project" && (
                      <div className="space-y-3">
                        {projectChecklistReport.map((project) => (
                          <Collapsible key={project.id} open={expandedProjects.has(project.id)} onOpenChange={() => toggleProjectExpand(project.id)}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  {expandedProjects.has(project.id) ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                  <div>
                                    <span className="font-semibold">{project.merchantName}</span>
                                    <span className="text-xs text-muted-foreground ml-2">({project.mid})</span>
                                    <span className="text-xs text-muted-foreground ml-2">Start: {project.dates.kickOffDate}</span>
                                  </div>
                                  <Badge variant="outline" className="capitalize">{project.currentOwnerTeam}</Badge>
                                  <Badge variant="secondary">{project.stats.completedChecklist}/{project.stats.totalChecklist} tasks</Badge>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right text-sm">
                                    <span className="text-primary font-medium">{formatDuration(project.stats.projectTime.gokwik)}</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-amber-500 font-medium">{formatDuration(project.stats.projectTime.merchant)}</span>
                                  </div>
                                  <div className="w-24">
                                    <Progress value={project.stats.checklistProgress} className="h-2" />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{project.stats.checklistProgress}%</span>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 ml-8 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-muted/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">MINT Tasks</p>
                                    <p className="font-semibold">{project.mintCompleted}/{project.mintTotal}</p>
                                  </div>
                                  <div className="bg-muted/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Integration Tasks</p>
                                    <p className="font-semibold">{project.integrationCompleted}/{project.integrationTotal}</p>
                                  </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Checklist Item</TableHead>
                                        <TableHead>Phase</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Responsibility</TableHead>
                                        <TableHead>GoKwik Time</TableHead>
                                        <TableHead>Merchant Time</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {project.checklistItems.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.checklistTitle}</TableCell>
                                          <TableCell className="capitalize">{item.phase}</TableCell>
                                          <TableCell><Badge variant="outline" className="capitalize">{item.team}</Badge></TableCell>
                                          <TableCell className="capitalize">{item.responsibility}</TableCell>
                                          <TableCell>{formatDuration(item.gokwikTime)}</TableCell>
                                          <TableCell>{formatDuration(item.merchantTime)}</TableCell>
                                          <TableCell>
                                            {item.completed ? (
                                              <Badge className="bg-emerald-500/10 text-emerald-600">Done</Badge>
                                            ) : (
                                              <Badge variant="secondary">Pending</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}

                    {/* Merged Team + Owner Report */}
                    {reportType === "team" && (
                      <div className="space-y-6">
                        {teamOwnerReport.map((team) => (
                          <Card key={team.team} className="bg-muted/30">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`h-12 w-12 rounded-xl ${teamColors[team.team]} flex items-center justify-center text-white font-bold text-lg`}>
                                    {team.teamLabel.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-lg">{team.teamLabel}</p>
                                    <p className="text-sm text-muted-foreground">{team.projectCount} projects</p>
                                  </div>
                                </div>
                                {team.pendingCount > 0 && (
                                  <Badge className="bg-amber-500 text-white">{team.pendingCount} Pending</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold">{team.projectCount}</p>
                                  <p className="text-xs text-muted-foreground">Projects</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold">{team.completedTasks}/{team.totalTasks}</p>
                                  <p className="text-xs text-muted-foreground">Tasks</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold text-primary">{formatDuration(team.gokwikTime)}</p>
                                  <p className="text-xs text-muted-foreground">GoKwik</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold text-amber-500">{formatDuration(team.merchantTime)}</p>
                                  <p className="text-xs text-muted-foreground">Merchant</p>
                                </div>
                              </div>
                              {team.owners.length > 0 && (
                                <div>
                                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Owners in {team.teamLabel}
                                  </p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Projects</TableHead>
                                        <TableHead>Tasks</TableHead>
                                        <TableHead>GoKwik Time</TableHead>
                                        <TableHead>Merchant Time</TableHead>
                                        <TableHead>Project Names</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {team.owners.map((owner) => (
                                        <TableRow key={owner.ownerId}>
                                          <TableCell className="font-medium">{owner.ownerName}</TableCell>
                                          <TableCell>{owner.totalProjects}</TableCell>
                                          <TableCell>{owner.completedTasks}/{owner.totalTasks}</TableCell>
                                          <TableCell>{formatDuration(owner.gokwikTime)}</TableCell>
                                          <TableCell>{formatDuration(owner.merchantTime)}</TableCell>
                                          <TableCell className="max-w-[200px]">
                                            <span className="text-xs text-muted-foreground truncate block">
                                              {owner.projectNames.join(", ")}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="mt-0">
            <ChecklistManagement />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-0">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </main>

      <CSVUploadDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} />
      <AddProjectDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSave={handleAddProject} />

      {/* Bulk Assign Dialog */}
      {bulkAssignDialogOpen && (
        <AssignOwnerDialog
          open={bulkAssignDialogOpen}
          onOpenChange={setBulkAssignDialogOpen}
          projectIds={Array.from(selectedProjects)}
          onAssigned={() => setSelectedProjects(new Set())}
        />
      )}

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedProjects.size} project(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected projects and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk State Update */}
      <AlertDialog open={bulkStateDialogOpen} onOpenChange={setBulkStateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update state for {selectedProjects.size} project(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new project state to apply to all selected projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkStateValue} onValueChange={(v) => setBulkStateValue(v as ProjectState)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(projectStateLabels) as ProjectState[]).map(s => (
                  <SelectItem key={s} value={s}>{projectStateLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStateUpdate}>Update All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
