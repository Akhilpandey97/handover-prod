import { Project, ResponsibilityParty, calculateTimeByParty, formatDuration } from "@/data/projectsData";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Clock, Building2, Users, Minus } from "lucide-react";

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

  const handleChange = (value: string) => {
    if (value && (value === "gokwik" || value === "merchant" || value === "neutral")) {
      onToggle(project.id, value as ResponsibilityParty);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <ToggleGroup 
          type="single" 
          value={project.currentResponsibility}
          onValueChange={handleChange}
          className="gap-0 border rounded-lg overflow-hidden"
        >
          <ToggleGroupItem 
            value="gokwik" 
            aria-label="GoKwik"
            className="text-xs px-2 py-0.5 h-6 rounded-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Building2 className="h-3 w-3 mr-1" />
            GK
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="neutral" 
            aria-label="Neutral"
            className="text-xs px-1.5 py-0.5 h-6 rounded-none border-x data-[state=on]:bg-muted data-[state=on]:text-muted-foreground"
          >
            <Minus className="h-3 w-3" />
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="merchant" 
            aria-label="Merchant"
            className="text-xs px-2 py-0.5 h-6 rounded-none data-[state=on]:bg-amber-500 data-[state=on]:text-white"
          >
            <Users className="h-3 w-3 mr-1" />
            M
          </ToggleGroupItem>
        </ToggleGroup>
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
        <ToggleGroup 
          type="single" 
          value={project.currentResponsibility}
          onValueChange={handleChange}
          className="gap-0 border rounded-lg overflow-hidden"
        >
          <ToggleGroupItem 
            value="gokwik" 
            aria-label="GoKwik"
            className="text-xs px-3 py-1 h-8 rounded-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Building2 className="h-3 w-3 mr-1" />
            GoKwik
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="neutral" 
            aria-label="Neutral"
            className="text-xs px-3 py-1 h-8 rounded-none border-x data-[state=on]:bg-muted data-[state=on]:text-muted-foreground"
          >
            <Minus className="h-3 w-3 mr-1" />
            Neutral
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="merchant" 
            aria-label="Merchant"
            className="text-xs px-3 py-1 h-8 rounded-none data-[state=on]:bg-amber-500 data-[state=on]:text-white"
          >
            <Users className="h-3 w-3 mr-1" />
            Merchant
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`p-3 rounded-lg transition-all ${
            project.currentResponsibility === "gokwik"
              ? "bg-primary/10 border-2 border-primary/30"
              : "bg-muted/50 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">GoKwik</span>
            {project.currentResponsibility === "gokwik" && (
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
            project.currentResponsibility === "merchant"
              ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700"
              : "bg-muted/50 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium">Merchant</span>
            {project.currentResponsibility === "merchant" && (
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
      
      {project.currentResponsibility === "neutral" && (
        <div className="text-center py-2 text-xs text-muted-foreground bg-muted/30 rounded">
          <Minus className="h-3 w-3 inline mr-1" />
          Neutral - Time not being tracked
        </div>
      )}
    </div>
  );
};
