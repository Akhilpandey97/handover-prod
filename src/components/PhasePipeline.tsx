import { cn } from "@/lib/utils";
import { ProjectPhase, getPhaseLabel } from "@/data/projects";
import { Check } from "lucide-react";

interface PhasePipelineProps {
  currentPhase: ProjectPhase;
  className?: string;
}

const phases: ProjectPhase[] = ["scoping", "api_build", "integration", "testing", "live"];

export function PhasePipeline({ currentPhase, className }: PhasePipelineProps) {
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div key={phase} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center h-6 px-2.5 rounded-full text-xs font-medium transition-all",
                isCompleted && "bg-success text-success-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                isUpcoming && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="whitespace-nowrap">{getPhaseLabel(phase)}</span>
              )}
            </div>
            {index < phases.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-0.5",
                  index < currentIndex ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
