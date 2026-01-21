import { cn } from "@/lib/utils";

interface PhaseBadgeProps {
  phase: string;
  className?: string;
}

const getPhaseStyles = (phase: string): string => {
  const phaseLower = phase.toLowerCase();
  if (phaseLower.includes("live")) {
    return "bg-success/15 text-success border-success/30";
  }
  if (phaseLower.includes("testing") || phaseLower.includes("qa")) {
    return "bg-info/15 text-info border-info/30";
  }
  if (phaseLower.includes("integration") || phaseLower.includes("api")) {
    return "bg-primary/15 text-primary border-primary/30";
  }
  if (phaseLower.includes("scoping")) {
    return "bg-muted text-muted-foreground border-border";
  }
  return "bg-secondary text-secondary-foreground border-border";
};

export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border capitalize",
        getPhaseStyles(phase),
        className
      )}
    >
      {phase}
    </span>
  );
}
