import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { useCustomFields, useAllCustomFieldValues } from "@/hooks/useCustomFields";
import { Project, ProjectPhase, ProjectState, ResponsibilityParty, projectStateLabels } from "@/data/projectsData";
import { KanbanCard } from "./KanbanCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ProjectWorkspaceView } from "@/pages/ProjectWorkspace";
import { toast } from "sonner";
import { ArrowUpDown, ChevronDown, Filter, X } from "lucide-react";

const KANBAN_FIELD_OPTIONS = [
  { key: "projectState", label: "Project State" },
  { key: "currentPhase", label: "Current Phase" },
  { key: "currentOwnerTeam", label: "Current Team" },
  { key: "platform", label: "Platform" },
  { key: "category", label: "Category" },
  { key: "currentResponsibility", label: "Responsibility" },
  { key: "assignedOwnerName", label: "Assigned Owner" },
];

const STATE_COLORS: Record<string, { color: string; bg: string }> = {
  not_started: { color: "text-muted-foreground", bg: "bg-muted/40" },
  in_progress: { color: "text-blue-600", bg: "bg-blue-500/5" },
  on_hold: { color: "text-amber-600", bg: "bg-amber-500/5" },
  blocked: { color: "text-destructive", bg: "bg-destructive/5" },
  live: { color: "text-emerald-600", bg: "bg-emerald-500/5" },
};

const PHASE_COLORS: Record<string, { color: string; bg: string }> = {
  mint: { color: "text-purple-600", bg: "bg-purple-500/5" },
  integration: { color: "text-blue-600", bg: "bg-blue-500/5" },
  ms: { color: "text-amber-600", bg: "bg-amber-500/5" },
  completed: { color: "text-emerald-600", bg: "bg-emerald-500/5" },
};

const SORT_OPTIONS = [
  { key: "none", label: "Default" },
  { key: "merchantName", label: "Merchant Name" },
  { key: "arr", label: "ARR" },
  { key: "projectState", label: "State" },
  { key: "currentPhase", label: "Phase" },
  { key: "platform", label: "Platform" },
];

function getFieldValue(project: Project, field: string, customValuesMap?: Record<string, Record<string, string>>): string {
  switch (field) {
    case "projectState": return project.projectState;
    case "currentPhase": return project.currentPhase;
    case "currentOwnerTeam": return project.currentOwnerTeam;
    case "platform": return project.platform || "Unknown";
    case "category": return project.category || "Uncategorized";
    case "currentResponsibility": return project.currentResponsibility;
    case "assignedOwnerName": return project.assignedOwnerName || "Unassigned";
    default:
      if (field.startsWith("custom_field_") && customValuesMap) {
        const fieldId = field.replace("custom_field_", "");
        return customValuesMap[project.id]?.[fieldId] || "Unset";
      }
      return project.projectState;
  }
}

function getFieldLabel(value: string, field: string, labels: any): string {
  switch (field) {
    case "projectState": return labels.stateLabels[value] || projectStateLabels[value as ProjectState] || value;
    case "currentPhase": return labels.phaseLabels[value] || value;
    case "currentOwnerTeam": return labels.teamLabels[value] || value;
    case "currentResponsibility": return labels.responsibilityLabels[value] || value;
    default: return value;
  }
}

function getColumnStyle(value: string, field: string): { color: string; bg: string } {
  if (field === "projectState") return STATE_COLORS[value] || { color: "text-muted-foreground", bg: "bg-muted/40" };
  if (field === "currentPhase") return PHASE_COLORS[value] || { color: "text-muted-foreground", bg: "bg-muted/40" };
  const hash = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = [
    { color: "text-blue-600", bg: "bg-blue-500/5" },
    { color: "text-emerald-600", bg: "bg-emerald-500/5" },
    { color: "text-amber-600", bg: "bg-amber-500/5" },
    { color: "text-purple-600", bg: "bg-purple-500/5" },
    { color: "text-rose-600", bg: "bg-rose-500/5" },
  ];
  return colors[hash % colors.length];
}

function sortProjects(projects: Project[], sortField: string, sortDirection: "asc" | "desc"): Project[] {
  if (sortField === "none") return projects;
  return [...projects].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";
    switch (sortField) {
      case "merchantName": aVal = a.merchantName.toLowerCase(); bVal = b.merchantName.toLowerCase(); break;
      case "arr": aVal = a.arr; bVal = b.arr; break;
      case "projectState": aVal = a.projectState; bVal = b.projectState; break;
      case "currentPhase": aVal = a.currentPhase; bVal = b.currentPhase; break;
      case "platform": aVal = (a.platform || "").toLowerCase(); bVal = (b.platform || "").toLowerCase(); break;
      default: return 0;
    }
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

interface KanbanBoardProps {
  filteredProjects?: Project[];
}

export const KanbanBoard = ({ filteredProjects }: KanbanBoardProps) => {
  const { projects: allProjects, updateProject } = useProjects();
  const labels = useLabels();
  const { fields: customFields } = useCustomFields();
  const [groupField, setGroupField] = useState("projectState");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);

  // Local filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [responsibilityFilter, setResponsibilityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const projects = filteredProjects || allProjects;

  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { valuesMap: customValuesMap } = useAllCustomFieldValues(projectIds);

  // Unique values for filter dropdowns
  const uniquePlatforms = useMemo(() => {
    const vals = new Set<string>();
    projects.forEach(p => { if (p.platform) vals.add(p.platform); });
    return Array.from(vals).sort();
  }, [projects]);

  const uniqueOwners = useMemo(() => {
    const vals = new Set<string>();
    projects.forEach(p => { if (p.assignedOwnerName) vals.add(p.assignedOwnerName); });
    return Array.from(vals).sort();
  }, [projects]);

  const uniqueCategories = useMemo(() => {
    const vals = new Set<string>();
    projects.forEach(p => { if (p.category) vals.add(p.category); });
    return Array.from(vals).sort();
  }, [projects]);

  // Apply local filters
  const localFiltered = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = !searchQuery ||
        p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mid.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesState = stateFilter === "all" || p.projectState === stateFilter;
      const matchesPhase = phaseFilter === "all" || p.currentPhase === phaseFilter;
      const matchesPlatform = platformFilter === "all" || p.platform === platformFilter;
      const matchesOwner = ownerFilter === "all" || p.assignedOwnerName === ownerFilter;
      const matchesResponsibility = responsibilityFilter === "all" || p.currentResponsibility === responsibilityFilter;
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesState && matchesPhase && matchesPlatform && matchesOwner && matchesResponsibility && matchesCategory;
    });
  }, [projects, searchQuery, stateFilter, phaseFilter, platformFilter, ownerFilter, responsibilityFilter, categoryFilter]);

  // Apply sort
  const sortedProjects = useMemo(() => sortProjects(localFiltered, sortField, sortDirection), [localFiltered, sortField, sortDirection]);

  // Build combined group-by options including custom fields
  const allFieldOptions = useMemo(() => {
    const customOptions = customFields.map(f => ({ key: `custom_field_${f.id}`, label: f.field_label }));
    return [...KANBAN_FIELD_OPTIONS, ...customOptions];
  }, [customFields]);

  const columns = useMemo(() => {
    const groupMap = new Map<string, Project[]>();
    sortedProjects.forEach(p => {
      const val = getFieldValue(p, groupField, customValuesMap);
      const existing = groupMap.get(val) || [];
      existing.push(p);
      groupMap.set(val, existing);
    });

    return Array.from(groupMap.entries())
      .map(([key, groupProjects]) => ({
        key,
        label: getFieldLabel(key, groupField, labels),
        projects: groupProjects,
        ...getColumnStyle(key, groupField),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sortedProjects, groupField, labels, customValuesMap]);

  const standardOptions = allFieldOptions.filter(o => !o.key.startsWith("custom_field_"));
  const customOptions = allFieldOptions.filter(o => o.key.startsWith("custom_field_"));
  const supportsDragMove = ["projectState", "currentPhase", "currentOwnerTeam", "platform", "category", "currentResponsibility"].includes(groupField);

  const hasLocalFilters = searchQuery || stateFilter !== "all" || phaseFilter !== "all" || platformFilter !== "all" || ownerFilter !== "all" || responsibilityFilter !== "all" || categoryFilter !== "all";

  const clearLocalFilters = () => {
    setSearchQuery("");
    setStateFilter("all");
    setPhaseFilter("all");
    setPlatformFilter("all");
    setOwnerFilter("all");
    setResponsibilityFilter("all");
    setCategoryFilter("all");
  };
  
  const activeFilterCount = [stateFilter !== "all", phaseFilter !== "all", platformFilter !== "all", ownerFilter !== "all", responsibilityFilter !== "all", categoryFilter !== "all"].filter(Boolean).length;

  const handleProjectDrop = (projectId: string, targetValue: string) => {
    const project = allProjects.find((item) => item.id === projectId);
    if (!project || !supportsDragMove) return;

    if (getFieldValue(project, groupField, customValuesMap) === targetValue) return;

    const updatedProject: Project = { ...project };

    switch (groupField) {
      case "projectState":
        updatedProject.projectState = targetValue as ProjectState;
        break;
      case "currentPhase":
        updatedProject.currentPhase = targetValue as ProjectPhase;
        break;
      case "currentOwnerTeam":
        updatedProject.currentOwnerTeam = targetValue as Project["currentOwnerTeam"];
        break;
      case "currentResponsibility":
        updatedProject.currentResponsibility = targetValue as ResponsibilityParty;
        break;
      case "platform":
        updatedProject.platform = targetValue;
        break;
      case "category":
        updatedProject.category = targetValue;
        break;
      default:
        toast.info("Dragging is only supported for standard editable fields.");
        return;
    }

    updateProject(updatedProject);
    toast.success(`Moved ${project.merchantName} to ${getFieldLabel(targetValue, groupField, labels)}`);
  };

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Group By:</Label>
        <Select value={groupField} onValueChange={setGroupField}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {standardOptions.map(opt => (
              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
            ))}
            {customOptions.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Custom Fields</div>
                {customOptions.map(opt => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs w-[180px] pl-8"
          />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>

        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Filter className="h-3 w-3" />
              Filters
              {hasLocalFilters && (
                <Badge variant="default" className="ml-1 h-4 px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="absolute z-20 mt-1 bg-card border rounded-lg shadow-lg p-4 w-[640px]">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">State</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="not_started">{labels.stateLabels.not_started || "Not Started"}</SelectItem>
                    <SelectItem value="in_progress">{labels.stateLabels.in_progress || "In Progress"}</SelectItem>
                    <SelectItem value="on_hold">{labels.stateLabels.on_hold || "On Hold"}</SelectItem>
                    <SelectItem value="blocked">{labels.stateLabels.blocked || "Blocked"}</SelectItem>
                    <SelectItem value="live">{labels.stateLabels.live || "Live"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phase</Label>
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    <SelectItem value="mint">{labels.phaseLabels.mint || "MINT"}</SelectItem>
                    <SelectItem value="integration">{labels.phaseLabels.integration || "Integration"}</SelectItem>
                    <SelectItem value="ms">{labels.phaseLabels.ms || "Merchant Success"}</SelectItem>
                    <SelectItem value="completed">{labels.phaseLabels.completed || "Completed"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Platform</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {uniquePlatforms.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Owner</Label>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {uniqueOwners.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Responsibility</Label>
                <Select value={responsibilityFilter} onValueChange={setResponsibilityFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="gokwik">{labels.responsibilityLabels?.gokwik || "Internal"}</SelectItem>
                    <SelectItem value="merchant">{labels.responsibilityLabels?.merchant || "Merchant"}</SelectItem>
                    <SelectItem value="neutral">{labels.responsibilityLabels?.neutral || "Neutral"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              {hasLocalFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={clearLocalFilters}>
                  <X className="h-3 w-3" /> Clear Filters
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs ml-auto" onClick={() => setFiltersOpen(false)}>Done</Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sortField !== "none" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className={cn("h-3.5 w-3.5", sortDirection === "desc" && "rotate-180")} />
            </Button>
          )}
        </div>

        {/* Result count */}
        <span className="text-xs text-muted-foreground ml-auto">
          {sortedProjects.length} project{sortedProjects.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className="grid min-w-full flex-1 gap-4 overflow-x-auto pb-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(320px, 1fr))` }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="min-w-0"
            onDragOver={(event) => {
              if (!supportsDragMove) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              if (!supportsDragMove) return;
              event.preventDefault();
              const projectId = event.dataTransfer.getData("text/plain") || draggedProjectId;
              if (projectId) {
                handleProjectDrop(projectId, col.key);
              }
              setDraggedProjectId(null);
            }}
          >
            <Card className={cn("h-full", col.bg)}>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className={cn("font-semibold", col.color)}>
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {col.projects.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="space-y-3 pr-2">
                    {col.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No projects
                      </p>
                    ) : (
                      col.projects.map((project) => (
                        <KanbanCard
                          key={project.id}
                          project={project}
                          onOpenWorkspace={setSelectedProjectId}
                          draggable={supportsDragMove}
                          onDragStart={setDraggedProjectId}
                          onDragEnd={() => setDraggedProjectId(null)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {selectedProjectId ? (
        <div className="fixed inset-0 z-[70] bg-background/55 backdrop-blur-[2px] p-6">
          <div className="mx-auto h-full max-w-[1760px] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl">
            <ProjectWorkspaceView
              projectId={selectedProjectId}
              inModal
              onClose={() => setSelectedProjectId(null)}
              projectIds={columns.flatMap(col => col.projects.map(p => p.id))}
              onNavigate={setSelectedProjectId}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
