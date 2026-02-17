import { useMemo } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { ProjectState, projectStateLabels } from "@/data/projectsData";
import { ProjectCardNew } from "./ProjectCardNew";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATE_COLUMNS: { key: ProjectState; color: string; bg: string }[] = [
  { key: "not_started", color: "text-muted-foreground", bg: "bg-muted/40" },
  { key: "in_progress", color: "text-blue-600", bg: "bg-blue-500/5" },
  { key: "on_hold", color: "text-amber-600", bg: "bg-amber-500/5" },
  { key: "blocked", color: "text-destructive", bg: "bg-destructive/5" },
  { key: "live", color: "text-emerald-600", bg: "bg-emerald-500/5" },
];

export const KanbanBoard = () => {
  const { projects } = useProjects();
  const { stateLabels } = useLabels();

  const columns = useMemo(() => {
    return STATE_COLUMNS.map((col) => ({
      ...col,
      label: stateLabels[col.key] || projectStateLabels[col.key] || col.key,
      projects: projects.filter((p) => p.projectState === col.key),
    }));
  }, [projects, stateLabels]);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.key} className="flex-shrink-0 w-80">
            <Card className={cn("h-full", col.bg)}>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className={cn("font-semibold", col.color)}>
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {col.projects.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="space-y-3 pr-2">
                    {col.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No projects
                      </p>
                    ) : (
                      col.projects.map((project) => (
                        <ProjectCardNew key={project.id} project={project} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
