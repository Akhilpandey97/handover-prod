import { cn } from "@/lib/utils";

type StatusType = "In Progress" | "Completed" | "On Hold" | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const getStatusStyles = (status: StatusType): string => {
  switch (status) {
    case "In Progress":
      return "bg-warning/15 text-warning border-warning/30";
    case "Completed":
      return "bg-success/15 text-success border-success/30";
    case "On Hold":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        getStatusStyles(status),
        className
      )}
    >
      {status}
    </span>
  );
}
