import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLabels } from "@/contexts/LabelsContext";
import { computeHealthScore } from "@/utils/aiHealthScore";
import type { Project } from "@/data/projectsData";

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthTitle = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

/**
 * Monthly go-live tracker — groups projects by their target go-live month
 * and surfaces slippage risk for the selected month.
 */
export const MonthlyGoLiveTracker = ({
  projects,
  onOpenWorkspace,
}: {
  projects: Project[];
  onOpenWorkspace: (projectId: string) => void;
}) => {
  const { stateLabels, phaseLabels } = useLabels();
  const [cursor, setCursor] = useState(() => new Date());

  const activeMonth = monthKey(cursor);

  const monthProjects = useMemo(() => {
    return projects.filter((project) => {
      const target = project.dates.goLiveDate || project.dates.expectedGoLiveDate;
      if (!target) return false;
      return monthKey(new Date(target)) === activeMonth;
    });
  }, [projects, activeMonth]);

  const stats = useMemo(() => {
    const live = monthProjects.filter((p) => p.projectState === "live").length;
    const atRisk = monthProjects.filter(
      (p) => p.projectState === "blocked" || p.projectState === "on_hold" || computeHealthScore(p).score < 50,
    ).length;
    const slipped = monthProjects.filter(
      (p) =>
        p.projectState !== "live" &&
        p.dates.expectedGoLiveDate &&
        new Date(p.dates.expectedGoLiveDate) < new Date(),
    ).length;
    return { total: monthProjects.length, live, atRisk, slipped };
  }, [monthProjects]);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-1">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{monthTitle(cursor)} go-lives</h2>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{stats.total} planned</Badge>
          <Badge variant="outline" className="border-emerald-300 text-emerald-800">{stats.live} live</Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-800">{stats.atRisk} at risk</Badge>
          <Badge variant="outline" className="border-red-300 text-red-800">{stats.slipped} slipped</Badge>
        </div>
      </div>

      {monthProjects.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No go-lives targeted for {monthTitle(cursor)}.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {monthProjects.map((project) => {
            const health = computeHealthScore(project);
            const target = project.dates.goLiveDate || project.dates.expectedGoLiveDate!;
            const slipped =
              project.projectState !== "live" && new Date(target) < new Date();
            const done = project.checklist.filter((item) => item.completed).length;

            return (
              <Card
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenWorkspace(project.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpenWorkspace(project.id);
                }}
                className={cn(
                  "cursor-pointer space-y-3 border-l-4 p-4 transition hover:shadow-md",
                  project.projectState === "live"
                    ? "border-l-emerald-500"
                    : slipped
                      ? "border-l-red-500"
                      : health.score < 50
                        ? "border-l-amber-500"
                        : "border-l-primary",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.merchantName}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{project.mid}</p>
                  </div>
                  {project.projectState === "live" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : slipped ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {phaseLabels[project.currentPhase] || project.currentPhase}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {stateLabels[project.projectState] || project.projectState}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Readiness</span>
                    <span className="font-mono">{project.goLivePercent || 0}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, project.goLivePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
                  <span>
                    {done}/{project.checklist.length} steps
                  </span>
                  <span className={cn(slipped && "font-semibold text-red-700")}>Target {target}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MonthlyGoLiveTracker;
