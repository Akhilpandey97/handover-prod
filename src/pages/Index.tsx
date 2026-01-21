import { useState } from "react";
import { projects as initialProjects, Project, currentUser } from "@/data/projects";
import { UserProfileCard } from "@/components/UserProfileCard";
import { ProjectList } from "@/components/ProjectList";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Bell, Clock, CheckCircle2, Rocket, FolderKanban } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const handleAcceptKT = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, handoffStatus: "accepted" as const } : p
      )
    );
    const project = projects.find((p) => p.id === projectId);
    toast.success(`KT Accepted for ${project?.merchantName}`, {
      description: "Project is now in your active list",
    });
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.mid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingProjects = filteredProjects.filter((p) => p.handoffStatus === "pending");
  const activeProjects = filteredProjects.filter(
    (p) => p.handoffStatus === "accepted" || p.handoffStatus === "in_progress"
  );
  const completedProjects = filteredProjects.filter((p) => p.handoffStatus === "completed");

  const pendingCount = projects.filter((p) => p.handoffStatus === "pending").length;
  const activeCount = projects.filter(
    (p) => p.handoffStatus === "accepted" || p.handoffStatus === "in_progress"
  ).length;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">ProjectHub</span>
          </div>
        </div>

        <UserProfileCard pendingCount={pendingCount} activeCount={activeCount} />

        <nav className="flex-1 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Quick Stats
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Total ARR</span>
              <span className="font-bold">
                {projects.reduce((sum, p) => sum + p.arr, 0).toFixed(2)} cr
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Avg Go Live %</span>
              <span className="font-bold">
                {Math.round(
                  projects.reduce((sum, p) => sum + p.goLivePercent, 0) / projects.length
                )}
                %
              </span>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Handoff from: <span className="font-medium">MINT (Presales)</span>
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-pending text-[10px] font-bold text-pending-foreground flex items-center justify-center animate-pulse-soft">
                  {pendingCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">My Projects</h1>
              <p className="text-muted-foreground mt-1">
                Manage your project handoffs and track progress
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pending KT
                  {pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-pending/20 text-pending text-xs font-medium">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Active
                  {activeCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      {activeCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-0">
                <ProjectList
                  projects={pendingProjects}
                  onAcceptKT={handleAcceptKT}
                  emptyMessage="No pending KT handoffs"
                />
              </TabsContent>

              <TabsContent value="active" className="mt-0">
                <ProjectList
                  projects={activeProjects}
                  onAcceptKT={handleAcceptKT}
                  emptyMessage="No active projects"
                />
              </TabsContent>

              <TabsContent value="completed" className="mt-0">
                <ProjectList
                  projects={completedProjects}
                  onAcceptKT={handleAcceptKT}
                  emptyMessage="No completed projects yet"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
