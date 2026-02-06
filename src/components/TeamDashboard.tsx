import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors } from "@/data/teams";
import { Project, calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Clock,
  FolderKanban,
  LogOut,
  Rocket,
  Search,
  CheckCircle2,
  AlertCircle,
  Timer,
  Users,
  Building2,
  Layers,
} from "lucide-react";

type TabType = "pending" | "active" | "all";

export const TeamDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { getPendingProjects, getActiveProjects, projects, isLoading } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");

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

  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  allUserProjects.forEach((p) => {
    const time = calculateTimeFromChecklist(p.checklist);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

  const getDisplayProjects = () => {
    switch (activeTab) {
      case "pending": return filteredPending;
      case "active": return filteredActive;
      case "all": return filteredAll;
    }
  };

  const displayProjects = getDisplayProjects();

  const sidebarItems: { key: TabType; label: string; icon: React.ReactNode; count: number; color: string }[] = [
    { 
      key: "pending", 
      label: "Pending", 
      icon: <AlertCircle className="h-5 w-5" />, 
      count: pendingForUser.length,
      color: "text-amber-500"
    },
    { 
      key: "active", 
      label: "Active", 
      icon: <Rocket className="h-5 w-5" />, 
      count: activeForUser.length,
      color: "text-emerald-500"
    },
    { 
      key: "all", 
      label: "All Projects", 
      icon: <Layers className="h-5 w-5" />, 
      count: allUserProjects.length,
      color: "text-primary"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex">
      {/* Left Sidebar */}
      <aside className="w-72 border-r bg-card/50 backdrop-blur-sm flex flex-col">
        {/* Logo & Team */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl ${teamColors[currentUser.team]} flex items-center justify-center shadow-lg`}>
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{teamLabels[currentUser.team]}</h1>
              <p className="text-xs text-muted-foreground">Team Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
            Projects
          </p>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                  activeTab === item.key
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={activeTab === item.key ? "text-primary-foreground" : item.color}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <Badge 
                  variant={activeTab === item.key ? "secondary" : "outline"}
                  className={cn(
                    "font-bold min-w-[28px] justify-center",
                    activeTab === item.key && "bg-white/20 text-primary-foreground border-0"
                  )}
                >
                  {item.count}
                </Badge>
              </button>
            ))}
          </div>

          {/* Stats Section */}
          <div className="mt-8 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
              Overview
            </p>
            
            {/* Tasks Completed */}
            <div className="px-4 py-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl border border-emerald-200/30 dark:border-emerald-800/30">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasks Done</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {completedChecklist}/{totalChecklist}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Tracked */}
            <div className="px-4 py-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time Tracked</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    GoKwik
                  </span>
                  <span className="font-semibold text-primary">{formatDuration(totalGokwikTime)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 text-amber-500" />
                    Merchant
                  </span>
                  <span className="font-semibold text-amber-500">{formatDuration(totalMerchantTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full ${teamColors[currentUser.team]} flex items-center justify-center text-white font-bold shadow`}>
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-sm">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser.team}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-8">
          <div>
            <h2 className="text-xl font-bold">
              {activeTab === "pending" && "Pending Acceptance"}
              {activeTab === "active" && "Active Projects"}
              {activeTab === "all" && "All Projects"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {displayProjects.length} project{displayProjects.length !== 1 ? "s" : ""} found
            </p>
          </div>
          
          {/* Search */}
          <div className="w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or MID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </header>

        {/* Projects List */}
        <ScrollArea className="flex-1">
          <div className="p-8">
            {displayProjects.length === 0 ? (
              <div className="text-center py-20">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  {activeTab === "pending" && <Clock className="h-10 w-10 text-amber-500" />}
                  {activeTab === "active" && <Rocket className="h-10 w-10 text-emerald-500" />}
                  {activeTab === "all" && <FolderKanban className="h-10 w-10 text-muted-foreground" />}
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {activeTab === "pending" && "No Pending Projects"}
                  {activeTab === "active" && "No Active Projects"}
                  {activeTab === "all" && "No Projects Assigned"}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {activeTab === "pending" && "You don't have any projects waiting for acceptance."}
                  {activeTab === "active" && "Accept pending projects to get started."}
                  {activeTab === "all" && "Contact your manager for project assignments."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayProjects.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
};
