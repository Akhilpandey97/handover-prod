import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLabels } from "@/contexts/LabelsContext";
import { computeHealthScore } from "@/utils/aiHealthScore";
import type { Project } from "@/data/projectsData";

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthTitle = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

type ColumnKey =
  | "merchant"
  | "mid"
  | "phase"
  | "state"
  | "responsibility"
  | "readiness"
  | "checklist"
  | "health"
  | "arr"
  | "platform"
  | "owner"
  | "target";

const STORAGE_KEY = "golive_tracker_columns";

/**
 * Monthly go-live tracker — dense, filterable list of projects targeting
 * a go-live in the selected month.
 */
export const MonthlyGoLiveTracker = ({
  projects,
  onOpenWorkspace,
}: {
  projects: Project[];
  onOpenWorkspace?: (projectId: string) => void;
}) => {
  const navigate = useNavigate();
  const openProject = (projectId: string) =>
    onOpenWorkspace ? onOpenWorkspace(projectId) : navigate(`/projects/${projectId}`);
  const { stateLabels, phaseLabels, responsibilityLabels, getLabel } = useLabels();
  const [cursor, setCursor] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const COLUMNS: { key: ColumnKey; label: string; className?: string }[] = [
    { key: "merchant", label: getLabel("field_merchant_name") },
    { key: "mid", label: getLabel("field_mid") },
    { key: "phase", label: getLabel("field_current_phase") },
    { key: "state", label: getLabel("field_project_state") },
    { key: "responsibility", label: getLabel("field_current_responsibility") },
    { key: "readiness", label: getLabel("field_readiness") },
    { key: "checklist", label: getLabel("field_checklist") },
    { key: "health", label: getLabel("field_health_score") },
    { key: "arr", label: getLabel("field_arr") },
    { key: "platform", label: getLabel("field_platform") },
    { key: "owner", label: getLabel("field_sales_spoc") },
    { key: "target", label: getLabel("field_expected_go_live_date") },
  ];

  const [visible, setVisible] = useState<ColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as ColumnKey[];
    } catch { /* ignore */ }
    return ["merchant", "mid", "phase", "state", "responsibility", "readiness", "checklist", "health", "target"];
  });

  const toggleColumn = (key: ColumnKey) => {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const activeMonth = monthKey(cursor);

  const monthProjects = useMemo(() => {
    return projects.filter((project) => {
      const target = project.dates.goLiveDate || project.dates.expectedGoLiveDate;
      if (!target) return false;
      return monthKey(new Date(target)) === activeMonth;
    });
  }, [projects, activeMonth]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthProjects
      .map((project) => {
        const target = project.dates.goLiveDate || project.dates.expectedGoLiveDate!;
        const health = computeHealthScore(project);
        const slipped = project.projectState !== "live" && new Date(target) < new Date();
        const atRisk =
          project.projectState === "blocked" || project.projectState === "on_hold" || health.score < 50;
        const done = project.checklist.filter((item) => item.completed).length;
        return { project, target, health, slipped, atRisk, done };
      })
      .filter(({ project, slipped, atRisk }) => {
        if (q && !`${project.merchantName} ${project.mid}`.toLowerCase().includes(q)) return false;
        if (stateFilter !== "all" && project.projectState !== stateFilter) return false;
        if (phaseFilter !== "all" && project.currentPhase !== phaseFilter) return false;
        if (riskFilter === "slipped" && !slipped) return false;
        if (riskFilter === "at_risk" && !atRisk) return false;
        if (riskFilter === "live" && project.projectState !== "live") return false;
        return true;
      })
      .sort((a, b) => new Date(a.target).getTime() - new Date(b.target).getTime());
  }, [monthProjects, search, stateFilter, phaseFilter, riskFilter]);

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

  const exportCsv = () => {
    const cols = COLUMNS.filter((c) => visible.includes(c.key));
    const header = cols.map((c) => c.label).join(",");
    const lines = rows.map(({ project, target, health, done }) =>
      cols
        .map((c) => {
          const v = cellValue(c.key, { project, target, health, done });
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `go-live-${activeMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function cellValue(
    key: ColumnKey,
    ctx: { project: Project; target: string; health: { score: number }; done: number },
  ): string {
    const { project, target, health, done } = ctx;
    switch (key) {
      case "merchant": return project.merchantName;
      case "mid": return project.mid;
      case "phase": return phaseLabels[project.currentPhase] || project.currentPhase;
      case "state": return stateLabels[project.projectState] || project.projectState;
      case "responsibility":
        return project.currentResponsibility
          ? responsibilityLabels[project.currentResponsibility] || project.currentResponsibility
          : "—";
      case "readiness": return `${project.goLivePercent || 0}%`;
      case "checklist": return `${done}/${project.checklist.length}`;
      case "health": return String(health.score);
      case "arr": return project.arr ? String(project.arr) : "—";
      case "platform": return project.platform || "—";
      case "owner": return project.salesSpoc || "—";
      case "target": return target;
      default: return "";
    }
  }

  const visibleColumns = COLUMNS.filter((c) => visible.includes(c.key));

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant or MID"
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All phases</SelectItem>
            {Object.entries(phaseLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {Object.entries(stateLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="at_risk">At risk</SelectItem>
            <SelectItem value="slipped">Slipped</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Columns3 className="mr-1.5 h-3.5 w-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-72 overflow-y-auto p-1">
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <Checkbox
                      checked={visible.includes(c.key)}
                      onCheckedChange={() => toggleColumn(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No go-lives matching your filters for {monthTitle(cursor)}.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr>
                <th className="w-1 p-0" />
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, target, health, slipped, done }) => (
                <tr
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject(project.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") openProject(project.id); }}
                  className="cursor-pointer border-t border-border transition hover:bg-muted/40"
                >
                  <td className="p-0">
                    <div
                      className={cn(
                        "h-full w-1",
                        project.projectState === "live"
                          ? "bg-emerald-500"
                          : slipped
                            ? "bg-red-500"
                            : health.score < 50
                              ? "bg-amber-500"
                              : "bg-primary",
                      )}
                      style={{ minHeight: 40 }}
                    />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 align-middle">
                      {c.key === "merchant" ? (
                        <span className="flex items-center gap-1.5 font-semibold">
                          {project.merchantName}
                          {project.projectState === "live" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : slipped ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                          ) : null}
                        </span>
                      ) : c.key === "mid" ? (
                        <span className="font-mono text-[11px] text-muted-foreground">{project.mid}</span>
                      ) : c.key === "phase" ? (
                        <Badge variant="outline" className="text-[10px]">
                          {phaseLabels[project.currentPhase] || project.currentPhase}
                        </Badge>
                      ) : c.key === "state" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {stateLabels[project.projectState] || project.projectState}
                        </Badge>
                      ) : c.key === "readiness" ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, project.goLivePercent || 0)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px]">{project.goLivePercent || 0}%</span>
                        </div>
                      ) : c.key === "health" ? (
                        <span
                          className={cn(
                            "font-mono text-[11px] font-semibold",
                            health.score < 50 ? "text-red-600" : health.score < 75 ? "text-amber-600" : "text-emerald-600",
                          )}
                        >
                          {health.score}
                        </span>
                      ) : c.key === "target" ? (
                        <span className={cn("font-mono text-[11px]", slipped && "font-semibold text-red-600")}>
                          {target}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {cellValue(c.key, { project, target, health, done })}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MonthlyGoLiveTracker;
