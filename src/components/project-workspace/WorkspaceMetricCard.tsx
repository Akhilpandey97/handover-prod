import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceMetricCardProps {
  label: string;
  value: string;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
}

export const WorkspaceMetricCard = ({
  label,
  value,
  eyebrow,
  icon,
  className,
}: WorkspaceMetricCardProps) => {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/90 p-5 shadow-[0_24px_60px_-36px_hsl(var(--foreground)/0.22)] transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">{eyebrow}</p> : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tracking-[-0.03em] text-foreground sm:text-xl">{value || "—"}</p>
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/35 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
};
