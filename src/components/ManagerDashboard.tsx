import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors, TeamRole } from "@/data/teams";
import { UserManagement } from "./UserManagement";
import { ChecklistManagement } from "./ChecklistManagement";
import { CSVUploadDialog } from "./CSVUploadDialog";
import { AddProjectDialog } from "./AddProjectDialog";
import { Project, calculateTimeByParty, formatDuration } from "@/data/projectsData";
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
} from "lucide-react";
import { exportProjectsToCSV } from "@/utils/exportProjects";
import { toast } from "sonner";

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { projects, isLoading, addProject } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [reportType, setReportType] = useState<string>("project");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch profiles for owner filter (filtered by selected team)
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string; team: string }[]>([]);
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("id, name, team");
      setAllProfiles(data || []);
    };
    fetchProfiles();
  }, []);

  // Calculate project time stats helper
  const calculateProjectStats = (project: Project) => {
    const projectTime = calculateTimeByParty(project.responsibilityLog);
    const checklistTime = { gokwik: 0, merchant: 0 };
    
    project.checklist.forEach((item) => {
      const time = calculateTimeByParty(item.responsibilityLog);
      checklistTime.gokwik += time.gokwik;
      checklistTime.merchant += time.merchant;
    });

    const completedChecklist = project.checklist.filter((c) => c.completed).length;
    const totalChecklist = project.checklist.length;

    return {
      projectTime,
      checklistTime,
      completedChecklist,
      totalChecklist,
      checklistProgress: totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0,
    };
  };

  // Checklist Time Report - grouped by project
  const checklistByProjectReport = useMemo(() => {
    return projects.map((project) => {
      const checklistItems = project.checklist.map((item) => {
        const time = calculateTimeByParty(item.responsibilityLog);
        return {
          id: item.id,
          checklistTitle: item.title,
          team: item.ownerTeam,
          gokwikTime: time.gokwik,
          merchantTime: time.merchant,
          totalTime: time.gokwik + time.merchant,
          completed: item.completed,
        };
      });

      const totalGokwik = checklistItems.reduce((sum, i) => sum + i.gokwikTime, 0);
      const totalMerchant = checklistItems.reduce((sum, i) => sum + i.merchantTime, 0);
      const completedCount = checklistItems.filter(i => i.completed).length;

      return {
        projectId: project.id,
        projectName: project.merchantName,
        owner: project.salesSpoc,
        team: project.currentOwnerTeam,
        checklistItems,
        totalGokwik,
        totalMerchant,
        totalTime: totalGokwik + totalMerchant,
        completedCount,
        totalCount: checklistItems.length,
      };
    }).sort((a, b) => b.totalTime - a.totalTime);
  }, [projects]);

  // Owner-wise Report
  const ownerWiseReport = useMemo(() => {
    const ownerMap = new Map<string, {
      owner: string;
      totalProjects: number;
      completedTasks: number;
      totalTasks: number;
      gokwikTime: number;
      merchantTime: number;
      projects: string[];
    }>();

    projects.forEach((project) => {
      const owner = project.salesSpoc || "Unassigned";
      const existing = ownerMap.get(owner) || {
        owner,
        totalProjects: 0,
        completedTasks: 0,
        totalTasks: 0,
        gokwikTime: 0,
        merchantTime: 0,
        projects: [],
      };

      existing.totalProjects++;
      existing.projects.push(project.merchantName);
      existing.totalTasks += project.checklist.length;
      existing.completedTasks += project.checklist.filter(c => c.completed).length;

      const projectTime = calculateTimeByParty(project.responsibilityLog);
      existing.gokwikTime += projectTime.gokwik;
      existing.merchantTime += projectTime.merchant;

      project.checklist.forEach((item) => {
        const time = calculateTimeByParty(item.responsibilityLog);
        existing.gokwikTime += time.gokwik;
        existing.merchantTime += time.merchant;
      });

      ownerMap.set(owner, existing);
    });

    return Array.from(ownerMap.values()).sort((a, b) => b.totalProjects - a.totalProjects);
  }, [projects]);

  // Team-wise Report
  const teamWiseReport = useMemo(() => {
    const teams: TeamRole[] = ["mint", "integration", "ms"];
    return teams.map((team) => {
      const teamProjects = projects.filter(p => p.currentOwnerTeam === team);
      let gokwikTime = 0;
      let merchantTime = 0;
      let completedTasks = 0;
      let totalTasks = 0;

      teamProjects.forEach((project) => {
        const projectTime = calculateTimeByParty(project.responsibilityLog);
        gokwikTime += projectTime.gokwik;
        merchantTime += projectTime.merchant;

        project.checklist.forEach((item) => {
          if (item.ownerTeam === team) {
            totalTasks++;
            if (item.completed) completedTasks++;
            const time = calculateTimeByParty(item.responsibilityLog);
            gokwikTime += time.gokwik;
            merchantTime += time.merchant;
          }
        });
      });

      return {
        team,
        teamLabel: teamLabels[team],
        projectCount: teamProjects.length,
        pendingCount: teamProjects.filter(p => p.pendingAcceptance).length,
        completedTasks,
        totalTasks,
        gokwikTime,
        merchantTime,
      };
    });
  }, [projects]);

  // Project-wise detailed report
  const projectWiseReport = useMemo(() => {
    return projects.map((project) => {
      const stats = calculateProjectStats(project);
      const mintTasks = project.checklist.filter(c => c.ownerTeam === "mint");
      const integrationTasks = project.checklist.filter(c => c.ownerTeam === "integration");
      
      return {
        ...project,
        stats,
        mintCompleted: mintTasks.filter(c => c.completed).length,
        mintTotal: mintTasks.length,
        integrationCompleted: integrationTasks.filter(c => c.completed).length,
        integrationTotal: integrationTasks.length,
      };
    }).sort((a, b) => 
      (b.stats.projectTime.gokwik + b.stats.projectTime.merchant) - 
      (a.stats.projectTime.gokwik + a.stats.projectTime.merchant)
    );
  }, [projects]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  // Filter owners by selected team (must be before early returns)
  const filteredOwners = useMemo(() => {
    if (teamFilter === "all") return allProfiles.filter(p => p.team !== "manager");
    return allProfiles.filter(p => p.team === teamFilter);
  }, [allProfiles, teamFilter]);

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

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === "all" || p.currentOwnerTeam === teamFilter;
    const matchesOwner = ownerFilter === "all" || p.assignedOwner === ownerFilter;
    return matchesSearch && matchesTeam && matchesOwner;
  });

  // Stats
  const totalProjects = projects.length;
  const pendingProjects = projects.filter((p) => p.pendingAcceptance).length;
  const activeProjects = projects.filter((p) => !p.pendingAcceptance && p.currentPhase !== "completed").length;
  const completedProjects = projects.filter((p) => p.currentPhase === "completed").length;

  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  projects.forEach((p) => {
    const time = calculateTimeByParty(p.responsibilityLog);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

  const handleAddProject = (project: Project) => {
    addProject(project);
    toast.success(`Added ${project.merchantName}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="h-16 flex items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Manager Dashboard</h1>
                <p className="text-xs text-muted-foreground">Project Management Hub</p>
              </div>
            </div>

            {/* Search */}
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

            {/* Actions */}
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

            {/* User */}
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

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-blue-500/5 border-primary/20 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Total Projects</p>
                      <p className="text-4xl font-bold">{totalProjects}</p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <FolderKanban className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Across all teams</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Pending</p>
                      <p className="text-4xl font-bold text-amber-600">{pendingProjects}</p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="h-7 w-7 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Awaiting acceptance</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-200/50 dark:border-blue-800/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active</p>
                      <p className="text-4xl font-bold text-blue-600">{activeProjects}</p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                      <Rocket className="h-7 w-7 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">In progress</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-200/50 dark:border-emerald-800/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Completed</p>
                      <p className="text-4xl font-bold text-emerald-600">{completedProjects}</p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Successfully delivered</p>
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
                    {teamWiseReport.map((team) => {
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
                  <CardDescription>Total time tracked across all projects</CardDescription>
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
                        <div 
                          className="bg-primary transition-all" 
                          style={{ width: `${(totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%` }} 
                        />
                        <div 
                          className="bg-amber-500 transition-all" 
                          style={{ width: `${(totalMerchantTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6 mt-0">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    All Projects
                  </CardTitle>
                  <div className="flex gap-3">
                    <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setOwnerFilter("all"); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter by team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        <SelectItem value="mint">MINT</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="ms">MS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter by owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Owners</SelectItem>
                        {filteredOwners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-320px)] min-h-[500px]">
                  <div className="p-6 space-y-4">
                    {filteredProjects.length === 0 ? (
                      <div className="text-center py-20">
                        <FolderKanban className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Projects Found</h3>
                        <p className="text-muted-foreground">Try adjusting your filters or add a new project.</p>
                      </div>
                    ) : (
                      filteredProjects.map((project) => (
                        <ProjectCardNew key={project.id} project={project} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6 mt-0">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Reports
                  </CardTitle>
                  <div className="flex gap-2">
                    {[
                      { key: "project", icon: FolderKanban, label: "Project" },
                      { key: "checklist", icon: ListChecks, label: "Checklist" },
                      { key: "owner", icon: User, label: "Owner" },
                      { key: "team", icon: Building2, label: "Team" },
                    ].map(({ key, icon: Icon, label }) => (
                      <Button
                        key={key}
                        variant={reportType === key ? "default" : "outline"}
                        onClick={() => setReportType(key)}
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-320px)] min-h-[500px]">
                  <div className="p-6">
                    {/* Project Report */}
                    {reportType === "project" && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Tasks</TableHead>
                            <TableHead>GoKwik Time</TableHead>
                            <TableHead>Merchant Time</TableHead>
                            <TableHead>Progress</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectWiseReport.slice(0, 20).map((project) => (
                            <TableRow key={project.id}>
                              <TableCell className="font-medium">{project.merchantName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {project.currentOwnerTeam}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {project.stats.completedChecklist}/{project.stats.totalChecklist}
                              </TableCell>
                              <TableCell>{formatDuration(project.stats.projectTime.gokwik)}</TableCell>
                              <TableCell>{formatDuration(project.stats.projectTime.merchant)}</TableCell>
                              <TableCell className="min-w-[120px]">
                                <div className="flex items-center gap-2">
                                  <Progress value={project.stats.checklistProgress} className="h-2" />
                                  <span className="text-xs text-muted-foreground">{project.stats.checklistProgress}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {/* Checklist Report */}
                    {reportType === "checklist" && (
                      <div className="space-y-3">
                        {checklistByProjectReport.slice(0, 15).map((project) => (
                          <Collapsible
                            key={project.projectId}
                            open={expandedProjects.has(project.projectId)}
                            onOpenChange={() => toggleProjectExpand(project.projectId)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  {expandedProjects.has(project.projectId) ? (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                  )}
                                  <span className="font-semibold">{project.projectName}</span>
                                  <Badge variant="secondary">
                                    {project.completedCount}/{project.totalCount}
                                  </Badge>
                                </div>
                                <span className="font-medium">{formatDuration(project.totalTime)}</span>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 ml-8 border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Item</TableHead>
                                      <TableHead>GoKwik</TableHead>
                                      <TableHead>Merchant</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {project.checklistItems.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell>{item.checklistTitle}</TableCell>
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
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}

                    {/* Owner Report */}
                    {reportType === "owner" && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Owner</TableHead>
                            <TableHead>Projects</TableHead>
                            <TableHead>Tasks</TableHead>
                            <TableHead>GoKwik Time</TableHead>
                            <TableHead>Merchant Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ownerWiseReport.map((owner) => (
                            <TableRow key={owner.owner}>
                              <TableCell className="font-medium">{owner.owner}</TableCell>
                              <TableCell>{owner.totalProjects}</TableCell>
                              <TableCell>{owner.completedTasks}/{owner.totalTasks}</TableCell>
                              <TableCell>{formatDuration(owner.gokwikTime)}</TableCell>
                              <TableCell>{formatDuration(owner.merchantTime)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {/* Team Report */}
                    {reportType === "team" && (
                      <div className="grid gap-4">
                        {teamWiseReport.map((team) => (
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
                              <div className="grid grid-cols-4 gap-4">
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
    </div>
  );
};
