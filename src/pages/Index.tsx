import { useState } from "react";
import { projects, Project } from "@/data/projects";
import { ProjectTable } from "@/components/ProjectTable";
import { ProjectDetailPanel } from "@/components/ProjectDetailPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, FolderKanban } from "lucide-react";

const Index = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter(
    (project) =>
      project.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.mid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Project Manager</h1>
              <p className="text-sm text-muted-foreground">
                Track and manage merchant integrations
              </p>
            </div>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        <main className="flex-1 p-6">
          {/* Search and Filters */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects by name, MID, platform..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="text-2xl font-semibold mt-1">{projects.length}</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-semibold mt-1 text-warning">
                {projects.filter((p) => p.projectState === "In Progress").length}
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold mt-1 text-success">
                {projects.filter((p) => p.projectState === "Completed").length}
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Total ARR (cr)</p>
              <p className="text-2xl font-semibold mt-1">
                {projects.reduce((sum, p) => sum + p.arr, 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Projects Table */}
          <ProjectTable
            projects={filteredProjects}
            onSelectProject={setSelectedProject}
            selectedProjectId={selectedProject?.id ?? null}
          />

          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects found matching your search.</p>
            </div>
          )}
        </main>

        {/* Detail Panel */}
        {selectedProject && (
          <ProjectDetailPanel
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
