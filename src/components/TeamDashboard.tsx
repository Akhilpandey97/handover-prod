import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamColors } from "@/data/teams";
import { useLabels } from "@/contexts/LabelsContext";
import { Project, calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { fetchAiInsights } from "@/utils/aiInsights";
import { AiSmartAlerts } from "./AiSmartAlerts";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  Brain,
  Loader2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { DashboardSkeleton } from "./skeletons/DashboardSkeleton";

type TabType = "pending" | "active" | "all";

export const TeamDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { getPendingProjects, getActiveProjects, projects, isLoading } = useProjects();
  const { teamLabels, labels } = useLabels();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");

  if (!currentUser) return null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const pendingProjects = getPendingProjects(currentUser.team);
  const activeProjects = getActiveProjects(currentUser.team);

  const isRejectedForCurrentTeam = (project: Project) => {
    const lastTransfer = project.transferHistory.length > 0 ? project.transferHistory[project.transferHistory.length - 1] : null;
    return (
      project.currentOwnerTeam === currentUser.team &&
      !project.pendingAcceptance &&
      !project.assignedOwner &&
      Boolean(lastTransfer?.notes?.startsWith("REJECTED:"))
    );
  };
  
  // Filter projects assigned specifically to the current user
  const filterByOwner = (projectList: typeof projects) => {
    return projectList.filter((p) => p.assignedOwner === currentUser.id || isRejectedForCurrentTeam(p));
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

  const completionPct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar */}
      <aside className="w-[264px] shrink-0 flex flex-col bg-sidebar text-sidebar-foreground">
        {/* Logo & Team */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {labels.org_logo_url ? (
              <img src={labels.org_logo_url} alt="Logo" className="h-10 w-10 rounded-xl object-contain bg-sidebar-accent p-1" />
            ) : (
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <FolderKanban className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[15px] leading-tight truncate">{teamLabels[currentUser.team]}</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/50">Workspace</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <p className="text-[10px] font-semibold text-sidebar-foreground/45 uppercase tracking-[0.2em] mb-2 px-3">
            Projects
          </p>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                  activeTab === item.key
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={activeTab === item.key ? "text-sidebar-primary" : "text-sidebar-foreground/50"}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span
                  className={cn(
                    "min-w-[26px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                    activeTab === item.key
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "bg-sidebar-accent/70 text-sidebar-foreground/70"
                  )}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {/* Progress summary */}
          <div className="mt-5 mx-1 rounded-xl bg-sidebar-accent/50 p-4 ring-1 ring-sidebar-border">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Checklist</p>
              <p className="font-display text-lg font-bold text-sidebar-foreground">{completionPct}%</p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-background/60">
              <div className="h-full rounded-full bg-sidebar-primary transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-sidebar-foreground/50">
              {completedChecklist} of {totalChecklist} tasks complete
            </p>
          </div>

          {/* AI Alerts Section */}
          <div className="mt-4 px-1">
            <AiSmartAlerts projects={allUserProjects} compact />
          </div>
        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 border-b bg-background/85 backdrop-blur-md flex items-center justify-between gap-6 px-6 lg:px-8">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-[-0.02em]">
              {activeTab === "pending" && "Pending Acceptance"}
              {activeTab === "active" && "Active Projects"}
              {activeTab === "all" && "All Projects"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {displayProjects.length} project{displayProjects.length !== 1 ? "s" : ""} found
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="w-64 xl:w-80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or MID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-lg bg-muted/60 border-transparent focus-visible:bg-background"
                />
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2.5 pl-3 border-l">
              <ThemeToggle />
              <div className="hidden text-right sm:block">
                <p className="font-semibold text-[13px] leading-tight">{currentUser.name}</p>
                <p className="text-[11px] text-muted-foreground">{teamLabels[currentUser.team] || currentUser.team}</p>
              </div>
              <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {currentUser.name.charAt(0)}
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Projects List */}
        <ScrollArea className="flex-1">
          <div className="p-6 md:p-8 mx-auto w-full max-w-[1300px]">
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
