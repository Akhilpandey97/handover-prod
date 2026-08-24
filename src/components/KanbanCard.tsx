import { Project, projectStateLabels } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { Badge } from "@/components/ui/badge";
import { Calendar, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeHealthScore } from "@/utils/aiHealthScore";

const phaseLabels: Record<string, string> = {
  mint: "MINT",
  integration: "Integration",
  ms: "Merchant Success",
  completed: "Completed",
};

export const KanbanCard = ({
  project,
  onOpenWorkspace,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  project: Project;
  onOpenWorkspace: (projectId: string) => void;
  draggable?: boolean;
  onDragStart?: (projectId: string) => void;
  onDragEnd?: () => void;
}) => {
  const { stateLabels } = useLabels();

  const stateLabel =
    stateLabels[project.projectState] ||
    projectStateLabels[project.projectState] ||
    project.projectState;

  const phaseLabel = phaseLabels[project.currentPhase] || project.currentPhase;

  const completedChecklist = project.checklist.filter(c => c.completed).length;
  const totalChecklist = project.checklist.length;
  const healthScore = computeHealthScore(project);
  const isOverdue = Boolean(
    project.dates.expectedGoLiveDate &&
    new Date(project.dates.expectedGoLiveDate) < new Date() &&
    project.projectState !== "live",
  );
  const riskLabel = isOverdue ? "Go-live date passed" : healthScore.label !== "Healthy" ? healthScore.label : null;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        draggable={draggable}
        className={cn(
          "w-full rounded-lg border bg-card p-3.5 space-y-2.5 shadow-sm text-xs text-left transition hover:border-primary/40 hover:shadow-md cursor-pointer",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        onClick={() => onOpenWorkspace(project.id)}
        onDragStart={(event) => {
          if (!draggable) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", project.id);
          onDragStart?.(project.id);
        }}
        onDragEnd={() => onDragEnd?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenWorkspace(project.id);
          }
        }}
      >
        {/* Header: name + MID */}
        <div>
          <button
            className="font-semibold text-sm truncate text-left w-full hover:text-primary hover:underline cursor-pointer transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWorkspace(project.id);
            }}
          >
            {project.merchantName}
          </button>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">MID: {project.mid}</p>
        </div>

        {/* Status and ownership */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{stateLabel}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{phaseLabel}</Badge>
          {project.platform && project.platform !== "Custom" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5"><Globe className="h-2.5 w-2.5" />{project.platform}</Badge>}
          {project.assignedOwnerName && <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[9px] font-bold text-foreground" title={project.assignedOwnerName}>{project.assignedOwnerName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}
        </div>

        {riskLabel && <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground"><span className="h-1.5 w-1.5 rounded-full bg-current" />{riskLabel}</div>}

        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="font-mono">{completedChecklist}/{totalChecklist} checklist</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{project.dates.expectedGoLiveDate || "No date"}</span>
        </div>

      </div>
    </>
  );
};
