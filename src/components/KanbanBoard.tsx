import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { useCustomFields, useAllCustomFieldValues } from "@/hooks/useCustomFields";
import { Project, ProjectPhase, ProjectState, ResponsibilityParty, projectStateLabels } from "@/data/projectsData";
import { KanbanCard } from "./KanbanCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProjectWorkspaceView } from "@/pages/ProjectWorkspace";
import { toast } from "sonner";

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

function getFieldValue(project: Project, field: string, customValuesMap?: Record<string, Record<string, string>>): string {
  switch (field) {
    case "projectState": return project.projectState;
    case "currentPhase": return project.currentPhase;
    case "currentOwnerTeam": return project.currentOwnerTeam;
    case "platform": return project.platform || "Unknown";
    case "category": return project.category || "Uncategorized";
    case "currentResponsibility": return project.currentResponsibility;
    case "assignedOwnerName": return project.assignedOwnerName || "Unassigned";
    default:
      // Check if it's a custom field
      if (field.startsWith("custom_field_") && customValuesMap) {
        const fieldId = field.replace("custom_field_", "");
        return customValuesMap[project.id]?.[fieldId] || "Unset";
      }
      return project.projectState;
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
  const { projects, updateProject } = useProjects();
  const labels = useLabels();
  const { fields: customFields } = useCustomFields();
  const [groupField, setGroupField] = useState("projectState");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);

  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { valuesMap: customValuesMap } = useAllCustomFieldValues(projectIds);

  // Build combined group-by options including custom fields
  const allFieldOptions = useMemo(() => {
    const customOptions = customFields.map(f => ({ key: `custom_field_${f.id}`, label: f.field_label }));
    return [...KANBAN_FIELD_OPTIONS, ...customOptions];
  }, [customFields]);

  const columns = useMemo(() => {
    const groupMap = new Map<string, Project[]>();
    projects.forEach(p => {
      const val = getFieldValue(p, groupField, customValuesMap);
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
  }, [projects, groupField, labels, customValuesMap]);

  const standardOptions = allFieldOptions.filter(o => !o.key.startsWith("custom_field_"));
  const customOptions = allFieldOptions.filter(o => o.key.startsWith("custom_field_"));
  const supportsDragMove = ["projectState", "currentPhase", "currentOwnerTeam", "platform", "category", "currentResponsibility"].includes(groupField);

  const handleProjectDrop = (projectId: string, targetValue: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || !supportsDragMove) return;

    if (getFieldValue(project, groupField, customValuesMap) === targetValue) return;

    const updatedProject: Project = { ...project };

    switch (groupField) {
      case "projectState":
        updatedProject.projectState = targetValue as ProjectState;
        break;
      case "currentPhase":
        updatedProject.currentPhase = targetValue as ProjectPhase;
        break;
      case "currentOwnerTeam":
        updatedProject.currentOwnerTeam = targetValue as Project["currentOwnerTeam"];
        break;
      case "currentResponsibility":
        updatedProject.currentResponsibility = targetValue as ResponsibilityParty;
        break;
      case "platform":
        updatedProject.platform = targetValue;
        break;
      case "category":
        updatedProject.category = targetValue;
        break;
      default:
        toast.info("Dragging is only supported for standard editable fields.");
        return;
    }

    updateProject(updatedProject);
    toast.success(`Moved ${project.merchantName} to ${getFieldLabel(targetValue, groupField, labels)}`);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Group By:</Label>
        <Select value={groupField} onValueChange={setGroupField}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {standardOptions.map(opt => (
              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
            ))}
            {customOptions.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Custom Fields</div>
                {customOptions.map(opt => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div
        className="grid min-w-full flex-1 gap-4 overflow-x-auto pb-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(320px, 1fr))` }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="min-w-0"
            onDragOver={(event) => {
              if (!supportsDragMove) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              if (!supportsDragMove) return;
              event.preventDefault();
              const projectId = event.dataTransfer.getData("text/plain") || draggedProjectId;
              if (projectId) {
                handleProjectDrop(projectId, col.key);
              }
              setDraggedProjectId(null);
            }}
          >
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
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <div className="space-y-3 pr-2">
                    {col.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No projects
                      </p>
                    ) : (
                      col.projects.map((project) => (
                        <KanbanCard
                          key={project.id}
                          project={project}
                          onOpenWorkspace={setSelectedProjectId}
                          draggable={supportsDragMove}
                          onDragStart={setDraggedProjectId}
                          onDragEnd={() => setDraggedProjectId(null)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {selectedProjectId ? (
        <div className="fixed inset-0 z-[70] bg-background/55 backdrop-blur-[2px] p-6">
          <div className="mx-auto h-full max-w-[1760px] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl">
            <ProjectWorkspaceView
              projectId={selectedProjectId}
              inModal
              onClose={() => setSelectedProjectId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
