import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors, TeamRole } from "@/data/teams";
import { Project, calculateTimeByParty, formatDuration } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { projects } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  if (!currentUser) return null;

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
            <Card>
              <CardHeader>
                <CardTitle>Project Time Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.map((project) => {
                    const stats = calculateProjectStats(project);
                    return (
                      <div key={project.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{project.merchantName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {teamLabels[project.currentOwnerTeam as keyof typeof teamLabels]} • {project.salesSpoc}
                            </p>
                          </div>
                          <Badge className={teamColors[project.currentOwnerTeam as keyof typeof teamColors]}>
                            {project.currentPhase.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">GoKwik Time</p>
                            <p className="font-medium">{formatDuration(stats.projectTime.gokwik)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Merchant Time</p>
                            <p className="font-medium">{formatDuration(stats.projectTime.merchant)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Checklist Progress</p>
                            <p className="font-medium">{stats.completedChecklist}/{stats.totalChecklist} ({stats.checklistProgress}%)</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Checklist Time (GK)</p>
                            <p className="font-medium">{formatDuration(stats.checklistTime.gokwik)}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${stats.checklistProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
