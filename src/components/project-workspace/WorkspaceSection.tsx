import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WorkspaceSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const WorkspaceSection = ({
  title,
  description,
  icon,
  children,
  className,
  contentClassName,
}: WorkspaceSectionProps) => {
  return (
    <Card className={cn("overflow-hidden rounded-[2rem] border-border/60 bg-card/88", className)}>
      <CardHeader className="space-y-3 border-b border-border/50 bg-muted/10 pb-5">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background text-primary">
              {icon}
            </div>
          ) : null}
          <div className="space-y-1">
            <CardTitle className="text-2xl tracking-[-0.04em]">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
};
