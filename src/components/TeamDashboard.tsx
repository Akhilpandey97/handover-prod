import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { Project } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  LogOut,
  Rocket,
  Search,
  AlertCircle,
  Layers,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { DashboardSkeleton } from "./skeletons/DashboardSkeleton";

type TabType = "attention" | "active" | "completed";

export const TeamDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { projects, isLoading } = useProjects();
  const { teamLabels, labels } = useLabels();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");

  if (!currentUser) return null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

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
  
  const allUserProjects = filterByOwner(projects);
  const attentionForUser = allUserProjects.filter(
    (project) =>
      project.pendingAcceptance ||
      project.projectState === "blocked" ||
      isRejectedForCurrentTeam(project),
  );
  const activeForUser = allUserProjects.filter(
    (project) =>
      !project.pendingAcceptance &&
      project.projectState !== "live" &&
      project.currentPhase !== "completed" &&
      !isRejectedForCurrentTeam(project),
  );
  const completedForUser = allUserProjects.filter(
    (project) => project.projectState === "live" || project.currentPhase === "completed",
  );

  // Filter by search
  const filterProjects = (projectList: typeof projects) =>
    projectList.filter(
      (p) =>
        p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mid.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredAttention = filterProjects(attentionForUser);
  const filteredActive = filterProjects(activeForUser);
  const filteredCompleted = filterProjects(completedForUser);

  const getDisplayProjects = () => {
    switch (activeTab) {
      case "attention": return filteredAttention;
      case "active": return filteredActive;
      case "completed": return filteredCompleted;
    }
  };

  const displayProjects = getDisplayProjects();


  const sidebarItems: { key: TabType; label: string; icon: React.ReactNode; count: number; color: string }[] = [
    { 
      key: "attention",
      label: "Needs attention",
      icon: <AlertCircle className="h-5 w-5" />, 
      count: attentionForUser.length,
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
      key: "completed",
      label: "Completed",
      icon: <Layers className="h-5 w-5" />, 
      count: completedForUser.length,
      color: "text-primary"
    },
  ];

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

        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 border-b bg-background/85 backdrop-blur-md flex items-center justify-between gap-6 px-6 lg:px-8">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-[-0.02em]">
              {activeTab === "attention" && "Needs Attention"}
              {activeTab === "active" && "Active Projects"}
              {activeTab === "completed" && "Completed Projects"}
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
                  <FolderKanban className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {activeTab === "attention" && "Nothing needs your attention"}
                  {activeTab === "active" && "No Active Projects"}
                  {activeTab === "completed" && "No Completed Projects"}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {activeTab === "attention" && "Pending, blocked, and rejected projects will appear here."}
                  {activeTab === "active" && "Your assigned projects will appear here."}
                  {activeTab === "completed" && "Finished projects will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_130px_90px_150px] gap-3 pl-4 pr-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
                  <span>Project</span>
                  <span>State</span>
                  <span>My checklist</span>
                  <span>Waiting on</span>
                  <span>Go-live</span>
                  <span />
                </div>
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
