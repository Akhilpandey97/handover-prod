import { useState } from "react";
import { Project, calculateTimeFromChecklist, calculateProjectResponsibilityFromChecklist, formatDuration, projectStateLabels, projectStateColors, ProjectState } from "@/data/projectsData";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Clock, Building2, Users, TrendingUp, Calendar, Activity, ClipboardList, ExternalLink, User,
} from "lucide-react";

interface ProjectCardNewProps {
  project: Project;
}

export const ProjectCardNew = ({ project }: ProjectCardNewProps) => {
  const { currentUser } = useAuth();
  const { updateProject } = useProjects();
  const { teamLabels, responsibilityLabels, getLabel, stateLabels } = useLabels();
  const [expanded, setExpanded] = useState(false);

  const computedResponsibility = calculateProjectResponsibilityFromChecklist(project.checklist);
  const timeByParty = calculateTimeFromChecklist(project.checklist);
  const mintChecklist = project.checklist.filter(c => c.ownerTeam === "mint");
  const integrationChecklist = project.checklist.filter(c => c.ownerTeam === "integration");
  const mintCompleted = mintChecklist.filter(c => c.completed).length;
  const integrationCompleted = integrationChecklist.filter(c => c.completed).length;

  const currentTeamItems = project.checklist.filter(c => c.ownerTeam === project.currentOwnerTeam);
  const nextIncompleteItem = currentTeamItems.find(c => !c.completed) || project.checklist.find(c => !c.completed);
  const projectPhaseDisplay = nextIncompleteItem ? nextIncompleteItem.title : "All Complete";

  const handleStateChange = (newState: ProjectState) => {
    updateProject({ ...project, projectState: newState });
  };

  const handleOpenInNewTab = () => {
    window.open(`/project/${project.id}`, "_blank");
  };

  const responsibilityLabel = computedResponsibility === "gokwik"
    ? responsibilityLabels.gokwik
    : computedResponsibility === "merchant"
    ? responsibilityLabels.merchant
    : responsibilityLabels.neutral;

  const badgeColor = getLabel(`color_team_${project.currentPhase}_badge`);
  const hasDynamicBadge = badgeColor.startsWith("#");

  const defaultBadgeColors: Record<string, string> = {
    mint: "bg-blue-500", integration: "bg-purple-500", ms: "bg-emerald-500", completed: "bg-gray-500",
  };

  return (
    <div className="border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Thin strip header - clickable to open in new tab */}
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group" onClick={handleOpenInNewTab}>
        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 p-0.5 rounded hover:bg-muted"
        >
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Team badge */}
        <Badge
          className="text-white text-[10px] px-2 py-0 shrink-0"
          style={hasDynamicBadge ? { backgroundColor: badgeColor } : undefined}
          {...(!hasDynamicBadge ? { className: `${defaultBadgeColors[project.currentPhase] || "bg-primary"} text-white text-[10px] px-2 py-0 shrink-0` } : {})}
        >
          {(teamLabels[project.currentOwnerTeam] || project.currentPhase).toUpperCase()}
        </Badge>

        {/* Merchant name */}
        <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors min-w-0">
          {project.merchantName}
        </span>

        {/* MID */}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">{project.mid}</Badge>

        {/* Owner */}
        {project.assignedOwnerName && (
          <span className="text-xs text-muted-foreground truncate hidden md:inline">
            <User className="h-3 w-3 inline mr-0.5" />{project.assignedOwnerName}
          </span>
        )}

        {/* State badge */}
        <Badge className={`${projectStateColors[project.projectState]} text-[10px] px-1.5 py-0 ml-auto shrink-0`}>
          {stateLabels[project.projectState] || projectStateLabels[project.projectState]}
        </Badge>

        {/* ARR */}
        <span className="text-xs font-semibold shrink-0 w-16 text-right">{project.arr} Cr</span>

        {/* Checklist progress */}
        <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
          {project.checklist.filter(c => c.completed).length}/{project.checklist.length}
        </span>
      </div>

      {/* Expandable detail boxes */}
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20">
          <div className="grid grid-cols-4 gap-2">
            {/* ARR */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><TrendingUp className="h-3 w-3" />{getLabel("field_arr")}</div>
              <p className="text-sm font-bold">{project.arr} Cr</p>
            </div>
            {/* Pending With */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="text-[10px] text-muted-foreground mb-0.5">Pending With</div>
              <div className="flex items-center gap-1 text-sm font-semibold">
                {computedResponsibility === "gokwik" ? <Building2 className="h-3.5 w-3.5 text-primary" /> : computedResponsibility === "merchant" ? <Users className="h-3.5 w-3.5 text-amber-500" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                {responsibilityLabel}
              </div>
            </div>
            {/* Time */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><Clock className="h-3 w-3" />Time</div>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="text-primary">{formatDuration(timeByParty.gokwik)}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-amber-500">{formatDuration(timeByParty.merchant)}</span>
              </div>
            </div>
            {/* Checklist */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><ClipboardList className="h-3 w-3" />Checklist</div>
              <div className="text-xs font-semibold space-y-0">
                <div className="text-blue-600">{mintCompleted}/{mintChecklist.length} {teamLabels.mint}</div>
                <div className="text-purple-600">{integrationCompleted}/{integrationChecklist.length} {teamLabels.integration}</div>
              </div>
            </div>
            {/* Kick Off Date */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><Calendar className="h-3 w-3" />{getLabel("field_kick_off_date")}</div>
              <p className="text-sm font-semibold">{project.dates.kickOffDate || "—"}</p>
            </div>
            {/* Go Live Date */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><Calendar className="h-3 w-3" />Go-Live Date</div>
              <p className="text-sm font-semibold">{project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—"}</p>
            </div>
            {/* Project Phase */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><Activity className="h-3 w-3" />Project Phase</div>
              <p className="text-sm font-semibold truncate" title={projectPhaseDisplay}>{projectPhaseDisplay}</p>
            </div>
            {/* Project State */}
            <div className="bg-background rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5"><Activity className="h-3 w-3" />Project State</div>
              <Select value={project.projectState} onValueChange={(val) => handleStateChange(val as ProjectState)}>
                <SelectTrigger className="h-6 text-sm font-semibold border-0 p-0 shadow-none focus:ring-0 bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(projectStateLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${projectStateColors[key as ProjectState]}`}>{stateLabels[key] || label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
