import { Project, projectStateLabels, projectStateColors } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { fetchAiInsights } from "@/utils/aiInsights";
import { toast } from "sonner";
import { ChecklistDialog } from "./ChecklistDialog";

const phaseLabels: Record<string, string> = {
  mint: "MINT",
  integration: "Integration",
  ms: "Merchant Success",
  completed: "Completed",
};

export const KanbanCard = ({
  project,
  onOpenWorkspace,
}: {
  project: Project;
  onOpenWorkspace: (projectId: string) => void;
}) => {
  const { stateLabels } = useLabels();
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const stateLabel =
    stateLabels[project.projectState] ||
    projectStateLabels[project.projectState] ||
    project.projectState;

  const phaseLabel = phaseLabels[project.currentPhase] || project.currentPhase;

  const arrDisplay =
    project.arr >= 10000000
      ? `${(project.arr / 10000000).toFixed(1)} Cr`
      : project.arr >= 100000
        ? `${(project.arr / 100000).toFixed(1)} L`
        : project.arr.toLocaleString();

  const completedChecklist = project.checklist.filter(c => c.completed).length;
  const totalChecklist = project.checklist.length;

  const handleInsights = async () => {
    setLoadingInsights(true);
    try {
      const result = await fetchAiInsights({
        type: "project_insights",
        project: {
          merchantName: project.merchantName,
          mid: project.mid,
          phase: project.currentPhase,
          state: project.projectState,
          arr: project.arr,
        },
      });
      toast.info(result, { duration: 10000 });
    } catch (e: any) {
      toast.error(e.message || "Failed to get insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="w-full rounded-md border bg-card p-3 space-y-2 shadow-sm text-xs text-left transition hover:border-primary/40 hover:shadow-md cursor-pointer"
        onClick={() => onOpenWorkspace(project.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenWorkspace(project.id);
          }
        }}
      >
        <button
          className="font-semibold text-sm truncate text-left w-full hover:text-primary hover:underline cursor-pointer transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            onOpenWorkspace(project.id);
          }}
        >
          {project.merchantName}
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn("text-[10px] px-1.5 py-0", projectStateColors[project.projectState])}>
            {stateLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {phaseLabel}
          </Badge>
        </div>

        <div className="text-muted-foreground">
          ARR: <span className="font-medium text-foreground">{arrDisplay}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 text-primary"
            onClick={(event) => {
              event.stopPropagation();
              void handleInsights();
            }}
            disabled={loadingInsights}
          >
            <Sparkles className="h-3 w-3" />
            {loadingInsights ? "Loading…" : "AI Insights"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-primary"
            onClick={(event) => {
              event.stopPropagation();
              setChecklistOpen(true);
            }}
          >
            <ListChecks className="h-3 w-3" />
            {completedChecklist}/{totalChecklist}
          </Button>
        </div>
      </div>

      <ChecklistDialog
        project={project}
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
      />
    </>
  );
};
