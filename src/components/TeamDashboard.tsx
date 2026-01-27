import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors } from "@/data/teams";
import { Project } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { AddProjectDialog } from "./AddProjectDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  Clock,
  FolderKanban,
  LogOut,
  Plus,
  Rocket,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const TeamDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { getPendingProjects, getActiveProjects, projects, addProject, isLoading } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

  const pendingProjects = getPendingProjects(currentUser.team);
  const activeProjects = getActiveProjects(currentUser.team);
  
  // Filter by search
  const filterProjects = (projectList: typeof projects) =>
    projectList.filter(
      (p) =>
        p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mid.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredPending = filterProjects(pendingProjects);
  const filteredActive = filterProjects(activeProjects);

  // All projects this team has touched (for history)
  const allTeamProjects = projects.filter(
    (p) =>
      p.currentOwnerTeam === currentUser.team ||
      p.transferHistory.some(
        (t) => t.fromTeam === currentUser.team || t.toTeam === currentUser.team
      )
  );
  const filteredAll = filterProjects(allTeamProjects);

  const handleAddProject = (project: Project) => {
    addProject(project);
    toast.success(`Added ${project.merchantName}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo & Team */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <FolderKanban className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold">ProjectHub</h1>
                <p className="text-xs text-muted-foreground">
                  {teamLabels[currentUser.team]}
                </p>
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
                  className="pl-10"
                />
              </div>
            </div>

            {/* User & Actions */}
            <div className="flex items-center gap-3">
              {/* Add Project Button - Only for MINT */}
              {currentUser.team === "mint" && (
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              )}

              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {pendingProjects.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse">
                    {pendingProjects.length}
                  </span>
                )}
              </Button>

              <div className="flex items-center gap-2 pl-3 border-l">
                <div className={`h-8 w-8 rounded-full ${teamColors[currentUser.team]} flex items-center justify-center text-white font-semibold text-sm`}>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Pending</span>
              </div>
              <p className="text-2xl font-bold">{pendingProjects.length}</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Rocket className="h-4 w-4" />
                <span className="text-sm">Active</span>
              </div>
              <p className="text-2xl font-bold">{activeProjects.length}</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Total Handled</span>
              </div>
              <p className="text-2xl font-bold">{allTeamProjects.length}</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending
                {pendingProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    {pendingProjects.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <Rocket className="h-4 w-4" />
                Active
                {activeProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeProjects.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <FolderKanban className="h-4 w-4" />
                All Projects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {filteredPending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending projects</p>
                </div>
              ) : (
                filteredPending.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              {filteredActive.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active projects</p>
                </div>
              ) : (
                filteredActive.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              {filteredAll.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects found</p>
                </div>
              ) : (
                filteredAll.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddProject}
      />
    </div>
  );
};
