import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors } from "@/data/teams";
import { Project, calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  FolderKanban,
  LogOut,
  Rocket,
  Search,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Timer,
  Users,
  Building2,
  Target,
} from "lucide-react";

export const TeamDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { getPendingProjects, getActiveProjects, projects, isLoading } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  if (!currentUser) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    );
  }

  const pendingProjects = getPendingProjects(currentUser.team);
  const activeProjects = getActiveProjects(currentUser.team);
  
  // Filter projects assigned specifically to the current user
  const filterByOwner = (projectList: typeof projects) => {
    return projectList.filter((p) => p.assignedOwner === currentUser.id);
  };
  
  const pendingForUser = filterByOwner(pendingProjects);
  const activeForUser = filterByOwner(activeProjects);

  // Filter by search
  const filterProjects = (projectList: typeof projects) =>
    projectList.filter(
      (p) =>
        p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mid.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredPending = filterProjects(pendingForUser);
  const filteredActive = filterProjects(activeForUser);

  // All projects for this user
  const allUserProjects = filterByOwner(projects);
  const filteredAll = filterProjects(allUserProjects);

  // Calculate stats
  const totalChecklist = allUserProjects.reduce((sum, p) => sum + p.checklist.length, 0);
  const completedChecklist = allUserProjects.reduce((sum, p) => sum + p.checklist.filter(c => c.completed).length, 0);
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  allUserProjects.forEach((p) => {
    const time = calculateTimeFromChecklist(p.checklist);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="h-16 flex items-center justify-between gap-6">
            {/* Logo & Team Badge */}
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${teamColors[currentUser.team]} flex items-center justify-center shadow-lg`}>
                <FolderKanban className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">{teamLabels[currentUser.team]}</h1>
                <p className="text-xs text-muted-foreground">Team Dashboard</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by name or MID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="font-medium text-sm">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser.team} Team</p>
              </div>
              <div className={`h-10 w-10 rounded-full ${teamColors[currentUser.team]} flex items-center justify-center text-white font-bold shadow-lg`}>
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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pending</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pendingForUser.length}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Awaiting your acceptance</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-200/50 dark:border-blue-800/50 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeForUser.length}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Rocket className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Currently in progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-200/50 dark:border-emerald-800/50 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tasks Done</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completedChecklist}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{checklistProgress}%</span>
                </div>
                <Progress value={checklistProgress} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-200/50 dark:border-purple-800/50 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Time Tracked</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatDuration(totalGokwikTime)}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Timer className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  GK: {formatDuration(totalGokwikTime)}
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  M: {formatDuration(totalMerchantTime)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Tabs */}
        <Card className="shadow-xl border-border/50">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Your Projects
              </CardTitle>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {allUserProjects.length} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b px-6 pt-4">
                <TabsList className="h-11 bg-muted/50 p-1">
                  <TabsTrigger 
                    value="pending" 
                    className="gap-2 px-4 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
                  >
                    <Clock className="h-4 w-4" />
                    Pending
                    {pendingForUser.length > 0 && (
                      <Badge className="ml-1 h-5 px-2 bg-white/20 text-current">
                        {pendingForUser.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="active" 
                    className="gap-2 px-4 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                  >
                    <Rocket className="h-4 w-4" />
                    Active
                    {activeForUser.length > 0 && (
                      <Badge className="ml-1 h-5 px-2 bg-white/20 text-current">
                        {activeForUser.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="all" 
                    className="gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    <FolderKanban className="h-4 w-4" />
                    All Projects
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px]">
                <div className="p-6">
                  <TabsContent value="pending" className="space-y-4 mt-0">
                    {filteredPending.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                          <Clock className="h-10 w-10 text-amber-500" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">No Pending Projects</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                          You don't have any projects waiting for acceptance. Check back later or view your active projects.
                        </p>
                      </div>
                    ) : (
                      filteredPending.map((project) => (
                        <ProjectCardNew key={project.id} project={project} />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="active" className="space-y-4 mt-0">
                    {filteredActive.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                          <Rocket className="h-10 w-10 text-blue-500" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">No Active Projects</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                          You don't have any active projects at the moment. Accept pending projects to get started.
                        </p>
                      </div>
                    ) : (
                      filteredActive.map((project) => (
                        <ProjectCardNew key={project.id} project={project} />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="space-y-4 mt-0">
                    {filteredAll.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                          <FolderKanban className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">No Projects Assigned</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                          You don't have any projects assigned to you yet. Contact your manager for project assignments.
                        </p>
                      </div>
                    ) : (
                      filteredAll.map((project) => (
                        <ProjectCardNew key={project.id} project={project} />
                      ))
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
