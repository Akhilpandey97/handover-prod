import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors, TeamRole, teamUsers } from "@/data/teams";
import { Project, ProjectChecklist, calculateTimeByParty, formatDuration } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart3,
  Clock,
  FolderKanban,
  LogOut,
  Search,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Timer,
  ListChecks,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { projects, isLoading } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [reportType, setReportType] = useState<string>("project");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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

  if (!currentUser) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
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
    const matchesOwner = ownerFilter === "all" || p.salesSpoc === ownerFilter;
    return matchesSearch && matchesTeam && matchesOwner;
  });

  // Get unique owners
  const uniqueOwners = Array.from(new Set(projects.map((p) => p.salesSpoc).filter(Boolean)));

  // Team stats
  const teamStats = {
    mint: projects.filter((p) => p.currentOwnerTeam === "mint").length,
    integration: projects.filter((p) => p.currentOwnerTeam === "integration").length,
    ms: projects.filter((p) => p.currentOwnerTeam === "ms").length,
  };

  // Calculate project time stats
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

  // Overall stats
  const totalProjects = projects.length;
  const pendingProjects = projects.filter((p) => p.pendingAcceptance).length;
  const activeProjects = projects.filter((p) => !p.pendingAcceptance && p.currentPhase !== "completed").length;
  const completedProjects = projects.filter((p) => p.currentPhase === "completed").length;

  // Aggregate time stats
  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  projects.forEach((p) => {
    const time = calculateTimeByParty(p.responsibilityLog);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

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

      const teamMembers = teamUsers[team] || [];
      return {
        team,
        teamLabel: teamLabels[team],
        projectCount: teamProjects.length,
        pendingCount: teamProjects.filter(p => p.pendingAcceptance).length,
        completedTasks,
        totalTasks,
        gokwikTime,
        merchantTime,
        memberCount: teamMembers.length,
        avgTimePerProject: teamProjects.length > 0 ? (gokwikTime + merchantTime) / teamProjects.length : 0,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo & Team */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold">ProjectHub</h1>
                <p className="text-xs text-muted-foreground">Manager Dashboard</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* User */}
            <div className="flex items-center gap-2 pl-3 border-l">
              <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="ml-1">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              All Projects
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    Total Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalProjects}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-500">{pendingProjects}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-500">{activeProjects}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-500">{completedProjects}</p>
                </CardContent>
              </Card>
            </div>

            {/* Team Distribution */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Projects by Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="text-sm">MINT (Presales)</span>
                    </div>
                    <Badge variant="secondary">{teamStats.mint}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-purple-500" />
                      <span className="text-sm">Integration Team</span>
                    </div>
                    <Badge variant="secondary">{teamStats.integration}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">MS (Merchant Success)</span>
                    </div>
                    <Badge variant="secondary">{teamStats.ms}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5" />
                    Time Distribution (All Projects)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-sm">GoKwik Time</span>
                    </div>
                    <span className="font-medium">{formatDuration(totalGokwikTime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-sm">Merchant Time</span>
                    </div>
                    <span className="font-medium">{formatDuration(totalMerchantTime)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  <SelectItem value="mint">MINT (Presales)</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="ms">MS (Merchant Success)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Projects List */}
            <div className="space-y-4">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects found</p>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {/* Report Type Selector */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={reportType === "project" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("project")}
                className="gap-2"
              >
                <FolderKanban className="h-4 w-4" />
                Project Wise
              </Button>
              <Button
                variant={reportType === "checklist" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("checklist")}
                className="gap-2"
              >
                <ListChecks className="h-4 w-4" />
                Checklist Wise
              </Button>
              <Button
                variant={reportType === "owner" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("owner")}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Owner Wise
              </Button>
              <Button
                variant={reportType === "team" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("team")}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                Team Wise
              </Button>
            </div>

            {/* Project-wise Report */}
            {reportType === "project" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" />
                    Project Time Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>MINT Tasks</TableHead>
                        <TableHead>Integration Tasks</TableHead>
                        <TableHead>GoKwik Time</TableHead>
                        <TableHead>Merchant Time</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectWiseReport.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.merchantName}</TableCell>
                          <TableCell>
                            <Badge className={teamColors[project.currentOwnerTeam]}>
                              {teamLabels[project.currentOwnerTeam]}
                            </Badge>
                          </TableCell>
                          <TableCell>{project.salesSpoc}</TableCell>
                          <TableCell>
                            <span className="text-blue-600 font-medium">{project.mintCompleted}/{project.mintTotal}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-purple-600 font-medium">{project.integrationCompleted}/{project.integrationTotal}</span>
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
                </CardContent>
              </Card>
            )}

            {/* Checklist-wise Report - Grouped by Project */}
            {reportType === "checklist" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Checklist Time Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {checklistByProjectReport.map((project) => (
                    <Collapsible
                      key={project.projectId}
                      open={expandedProjects.has(project.projectId)}
                      onOpenChange={() => toggleProjectExpand(project.projectId)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedProjects.has(project.projectId) ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <h4 className="font-semibold">{project.projectName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {project.owner} • {project.completedCount}/{project.totalCount} tasks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge className={teamColors[project.team]}>
                              {teamLabels[project.team]}
                            </Badge>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatDuration(project.totalTime)}</p>
                              <p className="text-xs text-muted-foreground">Total Time</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-8 border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Checklist Item</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead>GoKwik Time</TableHead>
                                <TableHead>Merchant Time</TableHead>
                                <TableHead>Total Time</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {project.checklistItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.checklistTitle}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={teamColors[item.team]}>
                                      {teamLabels[item.team]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatDuration(item.gokwikTime)}</TableCell>
                                  <TableCell>{formatDuration(item.merchantTime)}</TableCell>
                                  <TableCell className="font-medium">{formatDuration(item.totalTime)}</TableCell>
                                  <TableCell>
                                    {item.completed ? (
                                      <Badge className="bg-green-100 text-green-700">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Done
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Pending
                                      </Badge>
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
                </CardContent>
              </Card>
            )}

            {/* Owner-wise Report */}
            {reportType === "owner" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Owner Performance Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner</TableHead>
                        <TableHead>Projects</TableHead>
                        <TableHead>Tasks Completed</TableHead>
                        <TableHead>GoKwik Time</TableHead>
                        <TableHead>Merchant Time</TableHead>
                        <TableHead>Total Time</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownerWiseReport.map((owner) => (
                        <TableRow key={owner.owner}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                {owner.owner.charAt(0)}
                              </div>
                              <span className="font-medium">{owner.owner}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{owner.totalProjects}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{owner.completedTasks}/{owner.totalTasks}</span>
                          </TableCell>
                          <TableCell>{formatDuration(owner.gokwikTime)}</TableCell>
                          <TableCell>{formatDuration(owner.merchantTime)}</TableCell>
                          <TableCell className="font-medium">
                            {formatDuration(owner.gokwikTime + owner.merchantTime)}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={owner.totalTasks > 0 ? (owner.completedTasks / owner.totalTasks) * 100 : 0} 
                                className="h-2" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {owner.totalTasks > 0 ? Math.round((owner.completedTasks / owner.totalTasks) * 100) : 0}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Team-wise Report */}
            {reportType === "team" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Team Performance Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    {teamWiseReport.map((team) => (
                      <div key={team.team} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                              team.team === "mint" ? "bg-blue-100 text-blue-600" :
                              team.team === "integration" ? "bg-purple-100 text-purple-600" :
                              "bg-green-100 text-green-600"
                            }`}>
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{team.teamLabel}</h4>
                              <p className="text-sm text-muted-foreground">{team.memberCount} members</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {team.projectCount} Projects
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Pending</p>
                            <p className="text-xl font-bold text-amber-500">{team.pendingCount}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Tasks Done</p>
                            <p className="text-xl font-bold text-green-500">{team.completedTasks}/{team.totalTasks}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">GoKwik Time</p>
                            <p className="text-xl font-bold">{formatDuration(team.gokwikTime)}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Merchant Time</p>
                            <p className="text-xl font-bold">{formatDuration(team.merchantTime)}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Avg/Project</p>
                            <p className="text-xl font-bold">{formatDuration(team.avgTimePerProject)}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Task Completion</span>
                            <span className="font-medium">
                              {team.totalTasks > 0 ? Math.round((team.completedTasks / team.totalTasks) * 100) : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={team.totalTasks > 0 ? (team.completedTasks / team.totalTasks) * 100 : 0} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
