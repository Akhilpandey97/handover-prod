import { Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: Project[];
  onAcceptKT: (projectId: string) => void;
  emptyMessage?: string;
}

export function ProjectList({ projects, onAcceptKT, emptyMessage = "No projects found" }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onAcceptKT={onAcceptKT} />
      ))}
    </div>
  );
}
