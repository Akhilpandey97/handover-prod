import { Project, projectStateLabels, projectStateColors } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { fetchAiInsights } from "@/utils/aiInsights";
import { toast } from "sonner";

const phaseLabels: Record<string, string> = {
  mint: "MINT",
  integration: "Integration",
  ms: "Merchant Success",
  completed: "Completed",
};

export const KanbanCard = ({ project }: { project: Project }) => {
  const { stateLabels } = useLabels();
  const [loadingInsights, setLoadingInsights] = useState(false);

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
    <div className="rounded-md border bg-card p-3 space-y-2 shadow-sm text-xs">
      <div className="font-semibold text-sm truncate">{project.merchantName}</div>

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

      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px] gap-1 text-primary"
        onClick={handleInsights}
        disabled={loadingInsights}
      >
        <Sparkles className="h-3 w-3" />
        {loadingInsights ? "Loading…" : "AI Insights"}
      </Button>
    </div>
  );
};
