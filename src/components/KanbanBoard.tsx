import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { Project, ProjectState, projectStateLabels } from "@/data/projectsData";
import { KanbanCard } from "./KanbanCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const KANBAN_FIELD_OPTIONS = [
  { key: "projectState", label: "Project State" },
  { key: "currentPhase", label: "Current Phase" },
  { key: "currentOwnerTeam", label: "Current Team" },
  { key: "platform", label: "Platform" },
  { key: "category", label: "Category" },
  { key: "currentResponsibility", label: "Responsibility" },
  { key: "assignedOwnerName", label: "Assigned Owner" },
];

const STATE_COLORS: Record<string, { color: string; bg: string }> = {
  not_started: { color: "text-muted-foreground", bg: "bg-muted/40" },
  in_progress: { color: "text-blue-600", bg: "bg-blue-500/5" },
  on_hold: { color: "text-amber-600", bg: "bg-amber-500/5" },
  blocked: { color: "text-destructive", bg: "bg-destructive/5" },
  live: { color: "text-emerald-600", bg: "bg-emerald-500/5" },
};

const PHASE_COLORS: Record<string, { color: string; bg: string }> = {
  mint: { color: "text-purple-600", bg: "bg-purple-500/5" },
  integration: { color: "text-blue-600", bg: "bg-blue-500/5" },
  ms: { color: "text-amber-600", bg: "bg-amber-500/5" },
  completed: { color: "text-emerald-600", bg: "bg-emerald-500/5" },
};

function getFieldValue(project: Project, field: string): string {
  switch (field) {
    case "projectState": return project.projectState;
    case "currentPhase": return project.currentPhase;
    case "currentOwnerTeam": return project.currentOwnerTeam;
    case "platform": return project.platform || "Unknown";
    case "category": return project.category || "Uncategorized";
    case "currentResponsibility": return project.currentResponsibility;
    case "assignedOwnerName": return project.assignedOwnerName || "Unassigned";
    default: return project.projectState;
  }
}

function getFieldLabel(value: string, field: string, labels: any): string {
  switch (field) {
    case "projectState": return labels.stateLabels[value] || projectStateLabels[value as ProjectState] || value;
    case "currentPhase": return labels.phaseLabels[value] || value;
    case "currentOwnerTeam": return labels.teamLabels[value] || value;
    case "currentResponsibility": return labels.responsibilityLabels[value] || value;
    default: return value;
  }
}

function getColumnStyle(value: string, field: string): { color: string; bg: string } {
  if (field === "projectState") return STATE_COLORS[value] || { color: "text-muted-foreground", bg: "bg-muted/40" };
  if (field === "currentPhase") return PHASE_COLORS[value] || { color: "text-muted-foreground", bg: "bg-muted/40" };
  // Use a rotating set of muted colors for other fields
  const hash = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = [
    { color: "text-blue-600", bg: "bg-blue-500/5" },
    { color: "text-emerald-600", bg: "bg-emerald-500/5" },
    { color: "text-amber-600", bg: "bg-amber-500/5" },
    { color: "text-purple-600", bg: "bg-purple-500/5" },
    { color: "text-rose-600", bg: "bg-rose-500/5" },
  ];
  return colors[hash % colors.length];
}

export const KanbanBoard = () => {
  const { projects } = useProjects();
  const labels = useLabels();
  const [groupField, setGroupField] = useState("projectState");

  const columns = useMemo(() => {
    const groupMap = new Map<string, Project[]>();
    projects.forEach(p => {
      const val = getFieldValue(p, groupField);
      const existing = groupMap.get(val) || [];
      existing.push(p);
      groupMap.set(val, existing);
    });

    return Array.from(groupMap.entries())
      .map(([key, groupProjects]) => ({
        key,
        label: getFieldLabel(key, groupField, labels),
        projects: groupProjects,
        ...getColumnStyle(key, groupField),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects, groupField, labels]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Group By:</Label>
        <Select value={groupField} onValueChange={setGroupField}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KANBAN_FIELD_OPTIONS.map(opt => (
              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.key} className="flex-shrink-0 w-64">
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
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3 pr-2">
                    {col.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No projects
                      </p>
                    ) : (
                      col.projects.map((project) => (
                        <KanbanCard key={project.id} project={project} />
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
