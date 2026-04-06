import { useState } from "react";
import { Project } from "@/data/projectsData";
import { fetchAiInsights } from "@/utils/aiInsights";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  RefreshCw,
  Flame,
  Clock,
  TrendingDown,
  CheckCircle2,
  Zap,
} from "lucide-react";

interface AiAlert {
  project: string;
  mid?: string;
  type: "risk" | "blocker" | "stale" | "opportunity" | "action";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
}

interface AiSmartAlertsProps {
  projects: Project[];
  compact?: boolean;
  maxAlerts?: number;
}

const severityConfig = {
  critical: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", icon: Flame, border: "border-red-500/30" },
  high: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle, border: "border-orange-500/30" },
  medium: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", icon: Clock, border: "border-yellow-500/30" },
  low: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", icon: TrendingDown, border: "border-blue-500/30" },
};

const typeLabels = {
  risk: "At Risk",
  blocker: "Blocked",
  stale: "Stale",
  opportunity: "Opportunity",
  action: "Action Needed",
};

export const AiSmartAlerts = ({ projects, compact = false, maxAlerts = 8 }: AiSmartAlertsProps) => {
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const generateAlerts = async () => {
    if (projects.length === 0) {
      toast.info("No projects to analyze");
      return;
    }
    setLoading(true);
    try {
      const projectSummaries = projects.slice(0, 30).map(p => ({
        name: p.merchantName,
        mid: p.mid,
        phase: p.currentPhase,
        state: p.projectState,
        owner: p.assignedOwnerName || "Unassigned",
        completedTasks: p.checklist.filter(c => c.completed).length,
        totalTasks: p.checklist.length,
        arr: p.arr,
        expectedGoLive: p.dates.expectedGoLiveDate,
        kickOff: p.dates.kickOffDate,
        daysInPhase: p.dates.kickOffDate
          ? Math.floor((Date.now() - new Date(p.dates.kickOffDate).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }));

      const result = await fetchAiInsights({
        type: "next_actions",
        projects: projectSummaries,
        instruction: `Analyze these projects and return a JSON array of alerts. Each alert should have: project (name), mid, type (risk|blocker|stale|opportunity|action), severity (critical|high|medium|low), message (1-2 sentences). Focus on: stale projects with no progress, missed go-live dates, unassigned high-ARR projects, blocked projects, nearly complete projects that need a push. Return ONLY valid JSON array, no markdown.`,
      });

      try {
        const cleaned = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          setAlerts(parsed.slice(0, maxAlerts));
        }
      } catch {
        // Fallback: create alerts from text
        setAlerts([{
          project: "Analysis",
          type: "action",
          severity: "medium",
          message: result.slice(0, 200),
        }]);
      }
      setLoaded(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate alerts");
    } finally {
      setLoading(false);
    }
  };

  if (!loaded && !loading) {
    return (
      <div className={cn("flex flex-col items-center gap-3 py-4", compact && "py-2")}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-4 w-4" />
          <span className="text-xs font-medium">AI Smart Alerts</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={generateAlerts}
        >
          <Zap className="h-3.5 w-3.5" />
          Scan for Risks & Alerts
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Brain className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-medium">Analyzing projects...</span>
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Smart Alerts</span>
          <Badge variant="secondary" className="text-[9px] h-4 px-1">{alerts.length}</Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={generateAlerts}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
      </div>
      <ScrollArea className={cn(compact ? "max-h-[200px]" : "max-h-[320px]")}>
        <div className="space-y-1.5 pr-2">
          {alerts.length === 0 && (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              All projects look healthy!
            </div>
          )}
          {alerts.map((alert, i) => {
            const config = severityConfig[alert.severity] || severityConfig.medium;
            const Icon = config.icon;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold truncate">{alert.project}</span>
                      {alert.mid && (
                        <span className="text-[9px] text-muted-foreground">MID {alert.mid}</span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[8px] h-3.5 px-1", config.color)}
                      >
                        {typeLabels[alert.type] || alert.type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
