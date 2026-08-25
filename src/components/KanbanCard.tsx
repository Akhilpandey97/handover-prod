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
  const checklistRatio = totalChecklist > 0 ? completedChecklist / totalChecklist : 0;
  const healthScore = computeHealthScore(project);
  const isOverdue = Boolean(
    project.dates.expectedGoLiveDate &&
    new Date(project.dates.expectedGoLiveDate) < new Date() &&
    project.projectState !== "live",
  );
  const riskLabel = isOverdue ? "Go-live date passed" : healthScore.label !== "Healthy" ? healthScore.label : null;

  const stateToneClass = cn(
    "text-[10px] px-1.5 py-0 border",
    project.projectState === "in_progress" || project.projectState === "live"
      ? "border-blue-300 bg-blue-50 text-blue-900"
      : project.projectState === "on_hold" || project.projectState === "blocked"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-border bg-background text-foreground",
  );

  const phaseToneClass = cn(
    "text-[10px] px-1.5 py-0 border",
    project.currentPhase === "integration" || project.currentPhase === "ms"
      ? "border-blue-200 bg-blue-50/70 text-blue-800"
      : "border-border bg-background text-foreground",
  );

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
          <Badge variant="outline" className={stateToneClass}>{stateLabel}</Badge>
          <Badge variant="outline" className={phaseToneClass}>{phaseLabel}</Badge>
          {project.platform && project.platform !== "Custom" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5"><Globe className="h-2.5 w-2.5" />{project.platform}</Badge>}
          {project.assignedOwnerName && <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-900" title={project.assignedOwnerName}>{project.assignedOwnerName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}
        </div>

        {riskLabel && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {riskLabel}
          </div>
        )}

        {/* Go-live progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>Go-Live</span>
            <span className="font-mono text-foreground">{project.goLivePercent || 0}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                (project.goLivePercent || 0) >= 80 ? "bg-emerald-500" : (project.goLivePercent || 0) >= 40 ? "bg-blue-500" : "bg-amber-500",
              )}
              style={{ width: `${Math.min(100, Math.max(0, project.goLivePercent || 0))}%` }}
            />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">ARR</span>
            <span className="font-mono font-semibold text-foreground">{project.arr ? `${project.arr} Cr` : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">TAT</span>
            <span className={cn("font-mono font-semibold", tatDays > 60 ? "text-amber-800" : "text-foreground")}>{tatDays}d</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">Checklist</span>
            <span
              className={cn(
                "font-mono font-semibold",
                checklistRatio > 0 && checklistRatio < 0.5 ? "text-amber-800" : "text-foreground",
              )}
            >
              {completedChecklist}/{totalChecklist}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">Waiting</span>
            <span className="font-semibold capitalize text-foreground">{project.currentResponsibility}</span>
          </div>
        </div>

        <div className={cn("flex items-center gap-1 text-[10px]", isOverdue ? "text-amber-800" : "text-muted-foreground")}>
          <Calendar className="h-3 w-3" />
          {project.dates.goLiveDate
            ? `Live ${project.dates.goLiveDate}`
            : project.dates.expectedGoLiveDate
              ? `Expected ${project.dates.expectedGoLiveDate}`
              : "No go-live date"}
        </div>


      </div>
    </>
  );
};
