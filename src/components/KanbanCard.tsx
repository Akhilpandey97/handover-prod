import { Project, projectStateLabels, projectStateColors } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ListChecks, Loader2, User, Calendar, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { fetchAiInsights } from "@/utils/aiInsights";
import { toast } from "sonner";
import { ChecklistDialog } from "./ChecklistDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

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
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsContent, setInsightsContent] = useState("");

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
  const checklistPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  const handleInsights = async () => {
    setLoadingInsights(true);
    setInsightsOpen(true);
    setInsightsContent("");
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
      setInsightsContent(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to get insights");
      setInsightsOpen(false);
    } finally {
      setLoadingInsights(false);
    }
  };

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

        {/* Status badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn("text-[10px] px-1.5 py-0", projectStateColors[project.projectState])}>
            {stateLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {phaseLabel}
          </Badge>
          {project.platform && project.platform !== "Custom" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
              <Globe className="h-2.5 w-2.5" />
              {project.platform}
            </Badge>
          )}
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="text-muted-foreground">
            ARR: <span className="font-semibold text-foreground">{arrDisplay}</span>
          </div>
          {project.assignedOwnerName && (
            <div className="text-muted-foreground flex items-center gap-1 truncate">
              <User className="h-2.5 w-2.5 shrink-0" />
              <span className="font-medium text-foreground truncate">{project.assignedOwnerName}</span>
            </div>
          )}
          {project.dates.expectedGoLiveDate && (
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              <span className="font-medium text-foreground">{project.dates.expectedGoLiveDate}</span>
            </div>
          )}
          {project.category && (
            <div className="text-muted-foreground truncate">{project.category}</div>
          )}
        </div>

        {/* Checklist progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Checklist {completedChecklist}/{totalChecklist}</span>
            <span>{checklistPercent}%</span>
          </div>
          <Progress value={checklistPercent} className="h-1.5" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-0.5">
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

      {/* AI Insights Dialog */}
      <Dialog open={insightsOpen} onOpenChange={setInsightsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Insights — {project.merchantName}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {loadingInsights ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Generating insights…</span>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{insightsContent}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
