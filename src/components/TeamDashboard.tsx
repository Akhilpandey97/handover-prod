import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { teamLabels, teamColors } from "@/data/teams";
import { Project } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FolderKanban,
  LogOut,
  Rocket,
  Search,
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
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Logo & Team */}
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">{teamLabels[currentUser.team]}</span>
            </div>

            {/* Search */}
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

            {/* User */}
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full ${teamColors[currentUser.team]} flex items-center justify-center text-white font-medium text-xs`}>
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
        <div className="max-w-3xl mx-auto">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 h-9">
              <TabsTrigger value="pending" className="gap-1.5 text-sm h-7 px-3">
                <Clock className="h-3.5 w-3.5" />
                Pending
                {pendingForUser.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {pendingForUser.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-1.5 text-sm h-7 px-3">
                <Rocket className="h-3.5 w-3.5" />
                Active
                {activeForUser.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {activeForUser.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5 text-sm h-7 px-3">
                <FolderKanban className="h-3.5 w-3.5" />
                All
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3 mt-0">
              {filteredPending.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No pending projects</p>
                </div>
              ) : (
                filteredPending.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-3 mt-0">
              {filteredActive.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Rocket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No active projects</p>
                </div>
              ) : (
                filteredActive.map((project) => (
                  <ProjectCardNew key={project.id} project={project} />
                ))
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-3 mt-0">
              {filteredAll.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No projects found</p>
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
    </div>
  );
};
