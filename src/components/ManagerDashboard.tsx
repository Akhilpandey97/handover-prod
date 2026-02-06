import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors, TeamRole } from "@/data/teams";
import { UserManagement } from "./UserManagement";
import { ProjectAssignment } from "./ProjectAssignment";
import { CSVUploadDialog } from "./CSVUploadDialog";
import { AddProjectDialog } from "./AddProjectDialog";
import { Project, calculateTimeByParty, formatDuration } from "@/data/projectsData";
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
  ListChecks,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  Upload,
  ArrowRightLeft,
  Plus,
} from "lucide-react";
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

  if (!currentUser) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
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

  const uniqueOwners = Array.from(new Set(projects.map((p) => p.salesSpoc).filter(Boolean)));

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Manager Dashboard</span>
            </div>

            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setCsvDialogOpen(true)} size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Project
              </Button>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <span className="text-sm font-medium hidden sm:block">{currentUser.name}</span>
              <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 h-9">
            <TabsTrigger value="overview" className="gap-1.5 text-sm h-7 px-3">
              <BarChart3 className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 text-sm h-7 px-3">
              <FolderKanban className="h-3.5 w-3.5" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 text-sm h-7 px-3">
              <TrendingUp className="h-3.5 w-3.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="assign" className="gap-1.5 text-sm h-7 px-3">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Assign
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-sm h-7 px-3">
              <Users className="h-3.5 w-3.5" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-0">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span className="text-xs">Total</span>
                  </div>
                  <p className="text-2xl font-bold">{totalProjects}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="text-xs">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-500">{pendingProjects}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs">Active</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-500">{activeProjects}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs">Completed</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-500">{completedProjects}</p>
                </CardContent>
              </Card>
            </div>

            {/* Team & Time Distribution */}
            <div className="grid md:grid-cols-2 gap-3">
              <Card className="border-border/60">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    By Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {teamWiseReport.map((team) => (
                    <div key={team.team} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{team.teamLabel}</span>
                      <Badge variant="secondary" className="text-xs">{team.projectCount}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">GoKwik</span>
                    <span className="font-medium">{formatDuration(totalGokwikTime)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Merchant</span>
                    <span className="font-medium">{formatDuration(totalMerchantTime)}</span>
                  </div>
                  <Progress 
                    value={(totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100} 
                    className="h-1.5" 
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 mt-0">
            <div className="flex gap-2 flex-wrap">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  <SelectItem value="mint">MINT</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="ms">MS</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map((owner) => (
                    <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No projects found</p>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-0">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "project", icon: FolderKanban, label: "Project" },
                { key: "checklist", icon: ListChecks, label: "Checklist" },
                { key: "owner", icon: User, label: "Owner" },
                { key: "team", icon: Building2, label: "Team" },
              ].map(({ key, icon: Icon, label }) => (
                <Button
                  key={key}
                  variant={reportType === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportType(key)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Project Report */}
            {reportType === "project" && (
              <Card className="border-border/60">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Project</TableHead>
                        <TableHead className="text-xs">Team</TableHead>
                        <TableHead className="text-xs">Tasks</TableHead>
                        <TableHead className="text-xs">GoKwik</TableHead>
                        <TableHead className="text-xs">Merchant</TableHead>
                        <TableHead className="text-xs">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectWiseReport.slice(0, 20).map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium text-sm">{project.merchantName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {project.currentOwnerTeam.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {project.stats.completedChecklist}/{project.stats.totalChecklist}
                          </TableCell>
                          <TableCell className="text-sm">{formatDuration(project.stats.projectTime.gokwik)}</TableCell>
                          <TableCell className="text-sm">{formatDuration(project.stats.projectTime.merchant)}</TableCell>
                          <TableCell className="min-w-[100px]">
                            <div className="flex items-center gap-2">
                              <Progress value={project.stats.checklistProgress} className="h-1.5" />
                              <span className="text-[10px] text-muted-foreground">{project.stats.checklistProgress}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Checklist Report */}
            {reportType === "checklist" && (
              <div className="space-y-2">
                {checklistByProjectReport.slice(0, 15).map((project) => (
                  <Collapsible
                    key={project.projectId}
                    open={expandedProjects.has(project.projectId)}
                    onOpenChange={() => toggleProjectExpand(project.projectId)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.projectId) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">{project.projectName}</span>
                          <span className="text-xs text-muted-foreground">
                            {project.completedCount}/{project.totalCount}
                          </span>
                        </div>
                        <span className="text-xs font-medium">{formatDuration(project.totalTime)}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 ml-6 border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Item</TableHead>
                              <TableHead className="text-xs">GoKwik</TableHead>
                              <TableHead className="text-xs">Merchant</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {project.checklistItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{item.checklistTitle}</TableCell>
                                <TableCell className="text-sm">{formatDuration(item.gokwikTime)}</TableCell>
                                <TableCell className="text-sm">{formatDuration(item.merchantTime)}</TableCell>
                                <TableCell>
                                  {item.completed ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]">Done</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px]">Pending</Badge>
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
              <Card className="border-border/60">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Owner</TableHead>
                        <TableHead className="text-xs">Projects</TableHead>
                        <TableHead className="text-xs">Tasks</TableHead>
                        <TableHead className="text-xs">GoKwik</TableHead>
                        <TableHead className="text-xs">Merchant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownerWiseReport.map((owner) => (
                        <TableRow key={owner.owner}>
                          <TableCell className="font-medium text-sm">{owner.owner}</TableCell>
                          <TableCell className="text-sm">{owner.totalProjects}</TableCell>
                          <TableCell className="text-sm">{owner.completedTasks}/{owner.totalTasks}</TableCell>
                          <TableCell className="text-sm">{formatDuration(owner.gokwikTime)}</TableCell>
                          <TableCell className="text-sm">{formatDuration(owner.merchantTime)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Team Report */}
            {reportType === "team" && (
              <div className="grid gap-3">
                {teamWiseReport.map((team) => (
                  <Card key={team.team} className="border-border/60">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">{team.teamLabel}</span>
                        <Badge variant="outline">{team.projectCount} Projects</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="font-semibold text-amber-500">{team.pendingCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tasks</p>
                          <p className="font-semibold">{team.completedTasks}/{team.totalTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">GoKwik</p>
                          <p className="font-semibold">{formatDuration(team.gokwikTime)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Merchant</p>
                          <p className="font-semibold">{formatDuration(team.merchantTime)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assign" className="mt-0">
            <ProjectAssignment />
          </TabsContent>

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
