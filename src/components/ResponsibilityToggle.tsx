import { Project, ResponsibilityParty, calculateTimeByParty, formatDuration } from "@/data/projectsData";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Building2, Users } from "lucide-react";

interface ResponsibilityToggleProps {
  project: Project;
  onToggle: (projectId: string, party: ResponsibilityParty) => void;
  compact?: boolean;
}

export const ResponsibilityToggle = ({
  project,
  onToggle,
  compact = false,
}: ResponsibilityToggleProps) => {
  const timeByParty = calculateTimeByParty(project.responsibilityLog);
  const isGoKwik = project.currentResponsibility === "gokwik";

  const handleToggle = () => {
    const newParty: ResponsibilityParty = isGoKwik ? "merchant" : "gokwik";
    onToggle(project.id, newParty);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
            isGoKwik
              ? "bg-primary/10 text-primary"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          }`}
        >
          {isGoKwik ? (
            <>
              <Building2 className="h-3 w-3" />
              <span>GoKwik</span>
            </>
          ) : (
            <>
              <Users className="h-3 w-3" />
              <span>Merchant</span>
            </>
          )}
        </div>
        <Switch
          checked={!isGoKwik}
          onCheckedChange={handleToggle}
          className="scale-75"
        />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Action Pending On
        </h4>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium transition-colors ${
              isGoKwik ? "text-primary" : "text-muted-foreground"
            }`}
          >
            GoKwik
          </span>
          <Switch checked={!isGoKwik} onCheckedChange={handleToggle} />
          <span
            className={`text-xs font-medium transition-colors ${
              !isGoKwik ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            }`}
          >
            Merchant
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`p-3 rounded-lg transition-all ${
            isGoKwik
              ? "bg-primary/10 border-2 border-primary/30"
              : "bg-muted/50 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">GoKwik</span>
            {isGoKwik && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                Active
              </Badge>
            )}
          </div>
          <p className="text-lg font-bold text-primary">{formatDuration(timeByParty.gokwik)}</p>
          <p className="text-xs text-muted-foreground">Total time</p>
        </div>

        <div
          className={`p-3 rounded-lg transition-all ${
            !isGoKwik
              ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700"
              : "bg-muted/50 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium">Merchant</span>
            {!isGoKwik && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500 text-white">
                Active
              </Badge>
            )}
          </div>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatDuration(timeByParty.merchant)}
          </p>
          <p className="text-xs text-muted-foreground">Total time</p>
        </div>
      </div>
    </div>
  );
};
