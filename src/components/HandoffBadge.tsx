import { cn } from "@/lib/utils";
import { HandoffStatus, getHandoffLabel } from "@/data/projects";
import { Clock, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

interface HandoffBadgeProps {
  status: HandoffStatus;
  className?: string;
  showIcon?: boolean;
}

const getStatusConfig = (status: HandoffStatus) => {
  switch (status) {
    case "pending":
      return {
        styles: "bg-pending/15 text-pending border-pending/30",
        icon: Clock,
      };
    case "accepted":
      return {
        styles: "bg-primary/15 text-primary border-primary/30",
        icon: CheckCircle2,
      };
    case "in_progress":
      return {
        styles: "bg-warning/15 text-warning border-warning/30",
        icon: ArrowRight,
      };
    case "completed":
      return {
        styles: "bg-success/15 text-success border-success/30",
        icon: Sparkles,
      };
  }
};

export function HandoffBadge({ status, className, showIcon = true }: HandoffBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.styles,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {getHandoffLabel(status)}
    </span>
  );
}
