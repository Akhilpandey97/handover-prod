import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useLabels } from "@/contexts/LabelsContext";
import { teamLabels as defaultTeamLabels, teamColors, TeamRole } from "@/data/teams";
import { UserManagement } from "./UserManagement";
import { TenantManagement } from "./TenantManagement";
import { SettingsPanel } from "./SettingsPanel";
import { ChecklistManagement } from "./ChecklistManagement";
import { BulkEditDialog, BulkFieldUpdates } from "./BulkEditDialog";
import { ProjectCalendar } from "./ProjectCalendar";
import { ParsedEmailsTab } from "./ParsedEmailsTab";
import { KanbanBoard } from "./KanbanBoard";
import { MonthlyGoLiveTracker } from "./MonthlyGoLiveTracker";
import { ActivityLog } from "./settings/ActivityLog";
import { WorkflowManager } from "./settings/WorkflowManager";
import { CSVUploadDialog } from "./CSVUploadDialog";
import { AddProjectDialog } from "./AddProjectDialog";
import { AssignOwnerDialog } from "./AssignOwnerDialog";
import { Project, calculateTimeByParty, calculateTimeFromChecklist, formatDuration, projectStateLabels, projectStateColors, ProjectState, ProjectPhase } from "@/data/projectsData";
import { supabase } from "@/integrations/supabase/client";
import { ProjectCardNew } from "./ProjectCardNew";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // kept for sub-tabs in reports
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowUpDown,
  BarChart3,
  Clock,
  Download,
  FolderKanban,
  CalendarRange,
  LogOut,
  Search,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Timer,
  Settings,
  PieChart,
  Rocket,
  Trash2,
  UserPlus,
  RefreshCw,
  Sparkles,
  Loader2,
  Pencil,
  CalendarDays,
  Mail,
  GripVertical,
  List,
} from "lucide-react";
import { exportProjectsToCSV } from "@/utils/exportProjects";
import { exportProjectChecklistCSV, exportTeamOwnerCSV } from "@/utils/reportExportCSV";
import { useCustomFields, useAllCustomFieldValues } from "@/hooks/useCustomFields";
import { ThemeToggle } from "./ThemeToggle";
import { toast } from "sonner";
import { fetchAiInsights } from "@/utils/aiInsights";
import { cn } from "@/lib/utils";
import { DashboardSkeleton } from "./skeletons/DashboardSkeleton";
import { computeHealthScore } from "@/utils/aiHealthScore";

// Report components
import { ExecutiveDashboard } from "./reports/ExecutiveDashboard";
import { OperationalReports } from "./reports/OperationalReports";
import { MerchantResponsibility } from "./reports/MerchantResponsibility";
import { TacticalLists } from "./reports/TacticalLists";
import { ReportsBuilder } from "./reports/ReportsBuilder";
import { ReportScheduler } from "./reports/ReportScheduler";
import { MovementReport } from "./reports/MovementReport";


// Sub-tab keys for reports and settings
const REPORTS_SUB_TABS = ["predefined", "builder", "scheduler"];
const SETTINGS_SUB_TABS = ["general", "workflow", "fields", "custom-fields", "checklist-forms", "colours", "email"];
const PREDEFINED_REPORT_TYPES = ["executive", "operational", "merchant", "tactical", "project", "team"];

// All nav items that can be toggled
const ALL_NAV_ITEMS = ["dashboard", "projects", "calendar", "reports", "checklist", "users", "settings", "emails"];

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { labels: appLabels, teamLabels, responsibilityLabels, phaseLabels, stateLabels: stateLabelsFromCtx, updateLabels } = useLabels();
  const { projects, isLoading, addProject, deleteProject, updateProject } = useProjects();
  const { fields: customFields } = useCustomFields();
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { valuesMap: customValuesMap } = useAllCustomFieldValues(projectIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [responsibilityFilter, setResponsibilityFilter] = useState<string[]>([]);
  const [arrMin, setArrMin] = useState<string>("");
  const [arrMax, setArrMax] = useState<string>("");
  const [kickOffFrom, setKickOffFrom] = useState<string>("");
  const [kickOffTo, setKickOffTo] = useState<string>("");
  const [goLiveFrom, setGoLiveFrom] = useState<string>("");
  const [goLiveTo, setGoLiveTo] = useState<string>("");
  const [reportType, setReportType] = useState<string>("executive");
  const [reportSubTab, setReportSubTab] = useState<string>("predefined");
  const [settingsSubTab, setSettingsSubTab] = useState<string>("general");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [projectView, setProjectView] = useState<"list" | "kanban" | "tracker">("kanban");

  // Sidebar expand state for sub-menus
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // List view column selection
  const LIST_VIEW_COLUMNS = [
    { key: "merchantName", label: "Merchant Name" },
    { key: "mid", label: "MID" },
    { key: "platform", label: "Platform" },
    { key: "category", label: "Category" },
    { key: "status", label: "Status" },
    { key: "phase", label: "Phase" },
    { key: "owner", label: "Owner" },
    { key: "responsibility", label: "Responsibility" },
    { key: "checklist", label: "Checklist" },
    { key: "arr", label: "ARR" },
    { key: "txnsPerDay", label: "Txns/Day" },
    { key: "aov", label: "AOV" },
    { key: "goLivePercent", label: "Go Live %" },
    { key: "pendingAcceptance", label: "Pending Acceptance" },
    { key: "kickOffDate", label: "Kick-Off" },
    { key: "goLiveDate", label: "Go-Live" },
    { key: "salesSpoc", label: "Sales SPOC" },
    { key: "integrationType", label: "Integration Type" },
    { key: "pgOnboarding", label: "PG Onboarding" },
    { key: "brandUrl", label: "Brand URL" },
    { key: "jiraLink", label: "JIRA Link" },
    { key: "brdLink", label: "BRD Link" },
    { key: "mintNotes", label: "MINT Notes" },
    { key: "projectNotes", label: "Project Notes" },
    { key: "currentPhaseComment", label: "Phase Comment" },
    { key: "transferCount", label: "Transfer Count" },
    { key: "risk", label: "Risk" },
  ];
  const [listViewColumns, setListViewColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("listview_columns");
      return saved ? JSON.parse(saved) : ["merchantName", "status", "phase", "owner", "checklist", "goLiveDate", "risk"];
    } catch { return ["merchantName", "status", "phase", "owner", "checklist", "goLiveDate", "risk"]; }
  });
  const [listViewPage, setListViewPage] = useState(1);
  const [listViewPageSize, setListViewPageSize] = useState(10);

  // Nav visibility from labels
  const getNavVisibility = (): Record<string, boolean> => {
    try {
      const saved = appLabels.nav_visibility;
      if (saved) return JSON.parse(saved);
    } catch {
      return Object.fromEntries(ALL_NAV_ITEMS.map(k => [k, true]));
    }
    return Object.fromEntries(ALL_NAV_ITEMS.map(k => [k, true]));
  };
  const navVisibility = getNavVisibility();

  // Draggable tab order
  const DEFAULT_TAB_ORDER = ["dashboard", "projects", "calendar", "reports", "checklist", "users", "settings", "emails"];
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("manager_tab_order");
      const parsed = saved ? JSON.parse(saved) : DEFAULT_TAB_ORDER;
      // Migrate: rename "overview" to "dashboard"
      return parsed.map((t: string) => t === "overview" ? "dashboard" : t);
    } catch { return DEFAULT_TAB_ORDER; }
  });
  const [draggedTab, setDraggedTab] = useState<string | null>(null);

  // AI insights state for inline reports
  const [projectAiInsight, setProjectAiInsight] = useState<string | null>(null);
  const [projectAiLoading, setProjectAiLoading] = useState(false);
  const [teamAiInsight, setTeamAiInsight] = useState<string | null>(null);
  const [teamAiLoading, setTeamAiLoading] = useState(false);

  // Bulk selection state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStateDialogOpen, setBulkStateDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkStateValue, setBulkStateValue] = useState<ProjectState>("in_progress");

  // Sort state for projects tab
  const [sortField, setSortField] = useState<string>("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listColumnsOpen, setListColumnsOpen] = useState(false);

  // Fetch profiles for owner filter
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string; team: string }[]>([]);
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("id, name, team");
      setAllProfiles(data || []);
    };
    fetchProfiles();
  }, []);

  // Set default active tab to first visible nav item on mount
  useEffect(() => {
    if (activeTab === "") {
      const visibleTabs = [...tabOrder, ...(currentUser?.team === "super_admin" && !tabOrder.includes("tenants") ? ["tenants"] : [])]
        .filter(tab => TAB_CONFIG_KEYS.includes(tab))
        .filter(tab => navVisibility[tab] !== false || tab === "tenants");
      if (visibleTabs.length > 0) {
        setActiveTab(visibleTabs[0]);
      } else {
        setActiveTab("dashboard");
      }
    }
  }, []);
  const TAB_CONFIG_KEYS = ["dashboard", "projects", "calendar", "reports", "settings", "tenants"];

  // Calculate project time stats helper - FIXED: uses checklist-level time
  const calculateProjectStats = (project: Project) => {
    const checklistTime = calculateTimeFromChecklist(project.checklist);

    const completedChecklist = project.checklist.filter((c) => c.completed).length;
    const totalChecklist = project.checklist.length;

    return {
      projectTime: checklistTime, // Use checklist-aggregated time as the source of truth
      checklistTime,
      completedChecklist,
      totalChecklist,
      checklistProgress: totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0,
    };
  };

  // Merged Project + Checklist Report
  const projectChecklistReport = useMemo(() => {
    return projects.map((project) => {
      const stats = calculateProjectStats(project);
      const mintTasks = project.checklist.filter(c => c.ownerTeam === "mint");
      const integrationTasks = project.checklist.filter(c => c.ownerTeam === "integration");

      const checklistItems = project.checklist.map((item) => {
        const time = calculateTimeByParty(item.responsibilityLog);
        return {
          id: item.id,
          checklistTitle: item.title,
          team: item.ownerTeam,
          phase: item.phase,
          gokwikTime: time.gokwik,
          merchantTime: time.merchant,
          totalTime: time.gokwik + time.merchant,
          completed: item.completed,
          responsibility: item.currentResponsibility,
        };
      });

      return {
        ...project,
        stats,
        mintCompleted: mintTasks.filter(c => c.completed).length,
        mintTotal: mintTasks.length,
        integrationCompleted: integrationTasks.filter(c => c.completed).length,
        integrationTotal: integrationTasks.length,
        checklistItems,
      };
    }).sort((a, b) =>
      (b.stats.projectTime.gokwik + b.stats.projectTime.merchant) -
      (a.stats.projectTime.gokwik + a.stats.projectTime.merchant)
    );
  }, [projects]);

  // Merged Team + Owner Report
  const teamOwnerReport = useMemo(() => {
    const teams: TeamRole[] = ["mint", "integration", "ms"];
    return teams.map((team) => {
      const teamProjects = projects.filter(p => p.currentOwnerTeam === team);
      let teamGokwikTime = 0;
      let teamMerchantTime = 0;
      let teamCompletedTasks = 0;
      let teamTotalTasks = 0;

      teamProjects.forEach((project) => {
        // Count tasks only for this team's checklist items
        project.checklist.forEach((item) => {
          if (item.ownerTeam === team) {
            teamTotalTasks++;
            if (item.completed) teamCompletedTasks++;
          }
        });
        // Sum time from ALL checklist items in the project (not just this team's)
        const projectTime = calculateTimeFromChecklist(project.checklist);
        teamGokwikTime += projectTime.gokwik;
        teamMerchantTime += projectTime.merchant;
      });

      const ownerMap = new Map<string, {
        ownerId: string; ownerName: string; totalProjects: number;
        completedTasks: number; totalTasks: number; gokwikTime: number;
        merchantTime: number; projectNames: string[];
      }>();

      teamProjects.forEach((project) => {
        const ownerId = project.assignedOwner || "unassigned";
        const ownerName = project.assignedOwnerName || "Unassigned";
        const existing = ownerMap.get(ownerId) || {
          ownerId, ownerName, totalProjects: 0, completedTasks: 0,
          totalTasks: 0, gokwikTime: 0, merchantTime: 0, projectNames: [],
        };

        existing.totalProjects++;
        existing.projectNames.push(project.merchantName);
        existing.totalTasks += project.checklist.filter(c => c.ownerTeam === team).length;
        existing.completedTasks += project.checklist.filter(c => c.ownerTeam === team && c.completed).length;

        // Sum time from ALL checklist items (not just this team's)
        const ownerProjectTime = calculateTimeFromChecklist(project.checklist);
        existing.gokwikTime += ownerProjectTime.gokwik;
        existing.merchantTime += ownerProjectTime.merchant;

        ownerMap.set(ownerId, existing);
      });

      return {
        team,
        teamLabel: teamLabels[team],
        projectCount: teamProjects.length,
        pendingCount: teamProjects.filter(p => p.pendingAcceptance).length,
        completedTasks: teamCompletedTasks,
        totalTasks: teamTotalTasks,
        gokwikTime: teamGokwikTime,
        merchantTime: teamMerchantTime,
        owners: Array.from(ownerMap.values()).sort((a, b) => b.totalProjects - a.totalProjects),
      };
    });
  }, [projects]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId);
      else newSet.add(projectId);
      return newSet;
    });
  };

  const filteredOwners = useMemo(() => {
    if (teamFilter.length === 0) return allProfiles.filter(p => p.team !== "manager");
    return allProfiles.filter(p => teamFilter.includes(p.team));
  }, [allProfiles, teamFilter]);

  useEffect(() => {
    setOwnerFilter((prev) => prev.filter((id) => filteredOwners.some((owner) => owner.id === id)));
  }, [filteredOwners]);

  // Bulk selection helpers
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId);
      else newSet.add(projectId);
      return newSet;
    });
  };

  const toggleSelectAll = (projectIds: string[]) => {
    setSelectedProjects(prev => {
      const allSelected = projectIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(projectIds);
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      deleteProject(id);
    }
    setSelectedProjects(new Set());
    setBulkDeleteDialogOpen(false);
    toast.success(`Deleted ${ids.length} project(s)`);
  };

  const handleBulkStateUpdate = async () => {
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      const project = projects.find(p => p.id === id);
      if (project) {
        updateProject({ ...project, projectState: bulkStateValue });
      }
    }
    setSelectedProjects(new Set());
    setBulkStateDialogOpen(false);
    toast.success(`Updated ${ids.length} project(s) to ${stateLabelsFromCtx[bulkStateValue] || projectStateLabels[bulkStateValue]}`);
  };

  const handleBulkEdit = async (updates: Partial<BulkFieldUpdates>, customFieldUpdates?: Record<string, string>) => {
    const ids = Array.from(selectedProjects);
    for (const id of ids) {
      const project = projects.find(p => p.id === id);
      if (!project) continue;
      const patched = { ...project };
      if (updates.projectState !== undefined) patched.projectState = updates.projectState;
      if (updates.platform !== undefined) patched.platform = updates.platform;
      if (updates.category !== undefined) patched.category = updates.category;
      if (updates.arr !== undefined) patched.arr = updates.arr;
      if (updates.txnsPerDay !== undefined) patched.txnsPerDay = updates.txnsPerDay;
      if (updates.aov !== undefined) patched.aov = updates.aov;
      if (updates.salesSpoc !== undefined) patched.salesSpoc = updates.salesSpoc;
      if (updates.integrationType !== undefined) patched.integrationType = updates.integrationType;
      if (updates.pgOnboarding !== undefined) patched.pgOnboarding = updates.pgOnboarding;
      if (updates.goLivePercent !== undefined) patched.goLivePercent = updates.goLivePercent;
      if (updates.brandUrl !== undefined) patched.links = { ...patched.links, brandUrl: updates.brandUrl };
      if (updates.jiraLink !== undefined) patched.links = { ...patched.links, jiraLink: updates.jiraLink };
      if (updates.brdLink !== undefined) patched.links = { ...patched.links, brdLink: updates.brdLink };
      if (updates.mintChecklistLink !== undefined) patched.links = { ...patched.links, mintChecklistLink: updates.mintChecklistLink };
      if (updates.integrationChecklistLink !== undefined) patched.links = { ...patched.links, integrationChecklistLink: updates.integrationChecklistLink };
      if (updates.kickOffDate !== undefined) patched.dates = { ...patched.dates, kickOffDate: updates.kickOffDate };
      if (updates.expectedGoLiveDate !== undefined) patched.dates = { ...patched.dates, expectedGoLiveDate: updates.expectedGoLiveDate };
      if (updates.goLiveDate !== undefined) patched.dates = { ...patched.dates, goLiveDate: updates.goLiveDate };
      if (updates.mintNotes !== undefined) patched.notes = { ...patched.notes, mintNotes: updates.mintNotes };
      if (updates.projectNotes !== undefined) patched.notes = { ...patched.notes, projectNotes: updates.projectNotes };
      if (updates.currentPhaseComment !== undefined) patched.notes = { ...patched.notes, currentPhaseComment: updates.currentPhaseComment };
      if (updates.phase2Comment !== undefined) patched.notes = { ...patched.notes, phase2Comment: updates.phase2Comment };
      updateProject(patched);

      // Save custom field values
      if (customFieldUpdates && Object.keys(customFieldUpdates).length > 0) {
        for (const [fieldId, value] of Object.entries(customFieldUpdates)) {
          const { data: existing } = await supabase
            .from("custom_field_values")
            .select("id")
            .eq("project_id", id)
            .eq("field_id", fieldId)
            .maybeSingle();
          if (existing) {
            await supabase.from("custom_field_values").update({ value }).eq("id", existing.id);
          } else {
            await supabase.from("custom_field_values").insert({
              project_id: id, field_id: fieldId, value, tenant_id: currentUser?.tenantId || null,
            });
          }
        }
      }
    }
    setSelectedProjects(new Set());
    toast.success(`Updated ${ids.length} project(s)`);
  };

  // Helper to get project phase label (next incomplete checklist item from current owner team)
  const getProjectPhaseLabel = (p: Project) => {
    const teamItems = p.checklist.filter(c => c.ownerTeam === p.currentOwnerTeam);
    const nextItem = teamItems.find(c => !c.completed) || p.checklist.find(c => !c.completed);
    return nextItem ? nextItem.title : "All Complete";
  };

  // Collect unique phase labels for filter dropdown
  const uniquePhaseLabels = useMemo(() => {
    const labels = new Set<string>();
    projects.forEach(p => labels.add(getProjectPhaseLabel(p)));
    return Array.from(labels).sort();
  }, [projects]);

  const uniquePlatforms = useMemo(() => {
    const vals = new Set<string>();
    projects.forEach(p => { if (p.platform) vals.add(p.platform); });
    return Array.from(vals).sort();
  }, [projects]);

  const uniqueCategories = useMemo(() => {
    const vals = new Set<string>();
    projects.forEach(p => { if (p.category) vals.add(p.category); });
    return Array.from(vals).sort();
  }, [projects]);

  if (!currentUser) return null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Filter projects with new filters
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter.length === 0 || teamFilter.includes(p.currentOwnerTeam);
    const matchesOwner = ownerFilter.length === 0 || ownerFilter.includes(p.assignedOwner || "");
    const matchesPhase = phaseFilter.length === 0 || phaseFilter.includes(getProjectPhaseLabel(p));
    const matchesState = stateFilter.length === 0 || stateFilter.includes(p.projectState);
    const matchesPlatform = platformFilter.length === 0 || platformFilter.includes(p.platform || "");
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(p.category || "");
    const matchesResponsibility = responsibilityFilter.length === 0 || responsibilityFilter.includes(p.currentResponsibility);
    const matchesArrMin = !arrMin || p.arr >= parseFloat(arrMin);
    const matchesArrMax = !arrMax || p.arr <= parseFloat(arrMax);
    const matchesKickOffFrom = !kickOffFrom || p.dates.kickOffDate >= kickOffFrom;
    const matchesKickOffTo = !kickOffTo || p.dates.kickOffDate <= kickOffTo;
    const matchesGoLiveFrom = !goLiveFrom || (p.dates.goLiveDate && p.dates.goLiveDate >= goLiveFrom) || (p.dates.expectedGoLiveDate && p.dates.expectedGoLiveDate >= goLiveFrom);
    const matchesGoLiveTo = !goLiveTo || (p.dates.goLiveDate && p.dates.goLiveDate <= goLiveTo) || (p.dates.expectedGoLiveDate && p.dates.expectedGoLiveDate <= goLiveTo);
    return matchesSearch && matchesTeam && matchesOwner && matchesPhase && matchesState && matchesPlatform && matchesCategory && matchesResponsibility && matchesArrMin && matchesArrMax && matchesKickOffFrom && matchesKickOffTo && matchesGoLiveFrom && matchesGoLiveTo;
  });

  // Stats - use filteredProjects so search applies everywhere
  const displayProjects = searchQuery ? filteredProjects : projects;
  const totalProjects = displayProjects.length;
  const pendingProjects = displayProjects.filter((p) => p.pendingAcceptance).length;
  const completedProjects = displayProjects.filter((p) => p.projectState === "live").length;
  const activeProjects = totalProjects - pendingProjects - completedProjects;

  const tatBooklet = (() => {
    const now = new Date();
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const validProjects = displayProjects.flatMap((project) => {
      const kickOff = project.dates.kickOffDate ? new Date(project.dates.kickOffDate) : null;
      if (!kickOff || Number.isNaN(kickOff.getTime())) return [];

      const end = project.dates.goLiveDate ? new Date(project.dates.goLiveDate) : now;
      const target = project.dates.expectedGoLiveDate ? new Date(project.dates.expectedGoLiveDate) : null;
      const elapsedDays = Math.max(0, Math.ceil((end.getTime() - kickOff.getTime()) / millisecondsPerDay));
      const targetDays = target && !Number.isNaN(target.getTime())
        ? Math.max(0, Math.ceil((target.getTime() - kickOff.getTime()) / millisecondsPerDay))
        : null;
      const isOverdue = project.projectState !== "live" && target !== null && target.getTime() < now.getTime();

      return [{ project, elapsedDays, targetDays, isOverdue }];
    });

    const average = (values: number[]) => values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const byTeam = (["mint", "integration", "ms"] as TeamRole[]).map((team) => {
      const teamProjects = validProjects.filter((entry) => entry.project.currentOwnerTeam === team);
      return {
        team,
        label: teamLabels[team],
        projectCount: teamProjects.length,
        averageElapsed: average(teamProjects.map((entry) => entry.elapsedDays)),
        averageTarget: average(teamProjects.flatMap((entry) => entry.targetDays === null ? [] : [entry.targetDays])),
        overdueCount: teamProjects.filter((entry) => entry.isOverdue).length,
      };
    });

    return {
      averageElapsed: average(validProjects.map((entry) => entry.elapsedDays)),
      averageTarget: average(validProjects.flatMap((entry) => entry.targetDays === null ? [] : [entry.targetDays])),
      overdueCount: validProjects.filter((entry) => entry.isOverdue).length,
      trackedCount: validProjects.length,
      byTeam,
    };
  })();

  // Pipeline stats for overview
  const totalArr = displayProjects.reduce((s, p) => s + p.arr, 0);
  const liveArr = displayProjects.filter(p => p.projectState === "live").reduce((s, p) => s + p.arr, 0);
  const blockedProjects = displayProjects.filter(p => p.projectState === "blocked").length;
  const onHoldProjects = displayProjects.filter(p => p.projectState === "on_hold").length;

  const handleAddProject = async (project: Project) => {
    return addProject(project);
  };

  const filteredProjectIds = filteredProjects.map(p => p.id);
  const allFilteredSelected = filteredProjectIds.length > 0 && filteredProjectIds.every(id => selectedProjects.has(id));

  const clearFilters = () => {
    setTeamFilter([]);
    setOwnerFilter([]);
    setPhaseFilter([]);
    setStateFilter([]);
    setPlatformFilter([]);
    setCategoryFilter([]);
    setResponsibilityFilter([]);
    setArrMin("");
    setArrMax("");
    setKickOffFrom("");
    setKickOffTo("");
    setGoLiveFrom("");
    setGoLiveTo("");
  };

  const hasActiveFilters = teamFilter.length > 0 || ownerFilter.length > 0 || phaseFilter.length > 0 || stateFilter.length > 0 || platformFilter.length > 0 || categoryFilter.length > 0 || responsibilityFilter.length > 0 || arrMin || arrMax || kickOffFrom || kickOffTo || goLiveFrom || goLiveTo;

  const activeFilterCount = [
    teamFilter.length > 0,
    ownerFilter.length > 0,
    phaseFilter.length > 0,
    stateFilter.length > 0,
    platformFilter.length > 0,
    categoryFilter.length > 0,
    responsibilityFilter.length > 0,
    arrMin,
    arrMax,
    kickOffFrom,
    kickOffTo,
    goLiveFrom,
    goLiveTo,
  ].filter(Boolean).length;

  const applyMultiToggle = (selected: string[], value: string, checked: boolean) => {
    if (checked) {
      return selected.includes(value) ? selected : [...selected, value];
    }
    return selected.filter((item) => item !== value);
  };

  const formatMultiLabel = (selected: string[], allLabel: string, singularLabel: string) => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1) return selected[0];
    return `${selected.length} ${singularLabel}s`;
  };

  const renderMultiFilter = (props: {
    label: string;
    selected: string[];
    allLabel: string;
    singularLabel: string;
    options: Array<{ value: string; label: string }>;
    onToggle: (value: string, checked: boolean) => void;
    onClear: () => void;
    summary?: string;
  }) => {
    const { label, selected, allLabel, singularLabel, options, onToggle, onClear, summary } = props;
    const triggerLabel = summary || formatMultiLabel(selected, allLabel, singularLabel);

    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">{label}</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal">
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px] max-h-[320px] overflow-y-auto">
            <DropdownMenuCheckboxItem checked={selected.length === 0} onCheckedChange={(checked) => checked && onClear()}>
              {allLabel}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => onToggle(option.value, checked === true)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Tab config for sidebar
  const TAB_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
    dashboard: { icon: <PieChart className="h-4 w-4" />, label: "Dashboard" },
    projects: { icon: <FolderKanban className="h-4 w-4" />, label: "Projects" },
    calendar: { icon: <CalendarDays className="h-4 w-4" />, label: "Calendar" },
    reports: { icon: <TrendingUp className="h-4 w-4" />, label: "Reports" },
    settings: { icon: <Settings className="h-4 w-4" />, label: "Settings" },
    tenants: { icon: <Building2 className="h-4 w-4" />, label: "Tenants" },
  };

  const SETTINGS_SUB_CONFIG: Record<string, { label: string }> = {
    general: { label: "General" },
    workflows: { label: "Workflow Management" },
    "activity-log": { label: "Activity Log" },
    "custom-fields": { label: "Custom Fields" },
    checklist: { label: "Checklist" },
    email: { label: "Email Settings" },
    users: { label: "Users" },
  };

  const REPORTS_SUB_CONFIG: Record<string, { label: string; icon?: string }> = {
    predefined: { label: "Pre Defined" },
    builder: { label: "Report Builder" },
    scheduler: { label: "Scheduler" },
    movement: { label: "Movement (AI)" },
  };


  const handleTabDragStart = (tab: string) => setDraggedTab(tab);
  const handleTabDragOver = (e: React.DragEvent, targetTab: string) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === targetTab) return;
    setTabOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedTab);
      const toIdx = newOrder.indexOf(targetTab);
      if (fromIdx === -1 || toIdx === -1) return prev;
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedTab);
      return newOrder;
    });
  };
  const handleTabDragEnd = () => {
    setDraggedTab(null);
    localStorage.setItem("manager_tab_order", JSON.stringify(tabOrder));
  };

  const handleNavToggle = async (navKey: string, enabled: boolean) => {
    const current = getNavVisibility();
    current[navKey] = enabled;
    await updateLabels({ nav_visibility: JSON.stringify(current) });
  };

  const fetchProjectAiInsight = async () => {
    setProjectAiLoading(true);
    try {
      const topProjects = projectChecklistReport.slice(0, 10).map(p => `${p.merchantName}: ${p.stats.completedChecklist}/${p.stats.totalChecklist} tasks, ${formatDuration(p.stats.projectTime.gokwik + p.stats.projectTime.merchant)} total`).join("; ");
      const result = await fetchAiInsights({
        type: "insights",
        project: {
          merchantName: `Project & Checklist Summary: ${projects.length} total projects. Top by time: ${topProjects}`,
          mid: "PCR",
          currentPhase: "overview",
          projectState: "overview",
          arr: 0,
          platform: "All",
          dates: { kickOffDate: "N/A" },
          currentOwnerTeam: "All",
          currentResponsibility: "N/A",
          checklist: [],
          transferHistory: [],
        },
      });
      setProjectAiInsight(result);
    } catch {
      setProjectAiInsight("Failed to generate AI insights.");
    } finally {
      setProjectAiLoading(false);
    }
  };

  const fetchTeamAiInsight = async () => {
    setTeamAiLoading(true);
    try {
      const teamSummary = teamOwnerReport.map(t => `${t.teamLabel}: ${t.projectCount} projects, ${t.completedTasks}/${t.totalTasks} tasks, ${t.owners.length} owners`).join("; ");
      const result = await fetchAiInsights({
        type: "insights",
        project: {
          merchantName: `Team & Owner Summary: ${teamSummary}`,
          mid: "TOR",
          currentPhase: "overview",
          projectState: "overview",
          arr: 0,
          platform: "All",
          dates: { kickOffDate: "N/A" },
          currentOwnerTeam: "All",
          currentResponsibility: "N/A",
          checklist: [],
          transferHistory: [],
        },
      });
      setTeamAiInsight(result);
    } catch {
      setTeamAiInsight("Failed to generate AI insights.");
    } finally {
      setTeamAiLoading(false);
    }
  };

  const openProjectWorkspaceTab = (projectId: string) => {
    window.open(`/projects/${projectId}`, "_blank", "noopener,noreferrer");
  };

  const sidebarTabs = [...tabOrder, ...(currentUser?.team === "super_admin" && !tabOrder.includes("tenants") ? ["tenants"] : [])]
    .filter(tab => tab !== "tenants" || currentUser?.team === "super_admin")
    .filter(tab => TAB_CONFIG[tab])
    .filter(tab => navVisibility[tab] !== false || tab === "tenants" || tab === "settings");

  const activeTabLabel = activeTab === "settings" 
    ? "Settings"
    : activeTab === "reports"
    ? `Reports — ${REPORTS_SUB_CONFIG[reportSubTab]?.label || "Pre Defined"}`
    : TAB_CONFIG[activeTab]?.label || "Dashboard";

  const sidebarTitle = "Handover";
  const sidebarSubtitle = "";
  const selectedFilteredCount = filteredProjectIds.filter(id => selectedProjects.has(id)).length;

  // Render a single nav item
  const renderNavItem = (tab: string) => {
    const isReports = tab === "reports";
    const isSettings = tab === "settings";
    const isActive = activeTab === tab;
    const isParentActive = isActive || (isReports && reportsExpanded) || (isSettings && settingsExpanded);

    return (
      <div key={tab}>
        <button
          onClick={() => {
            if (isReports) {
              setReportsExpanded(!reportsExpanded);
              if (!reportsExpanded) { setActiveTab("reports"); }
            } else if (isSettings) {
              setSettingsExpanded(!settingsExpanded);
              if (!settingsExpanded) { setActiveTab("settings"); }
            } else {
              setActiveTab(tab);
            }
          }}
          draggable
          onDragStart={() => handleTabDragStart(tab)}
          onDragOver={(e) => handleTabDragOver(e, tab)}
          onDragEnd={handleTabDragEnd}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group",
            isActive && !isReports && !isSettings
              ? "gradient-primary text-primary-foreground shadow-[var(--shadow-soft)]"
              : isParentActive
              ? "bg-primary/20 text-sidebar-foreground font-semibold"
              : "hover:bg-sidebar-accent/60 text-sidebar-foreground",
            draggedTab === tab ? "opacity-50" : ""
          )}
        >
          <span className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors",
            isActive && !isReports && !isSettings
              ? "bg-primary-foreground/20 text-primary-foreground"
              : isParentActive
              ? "bg-primary/10 text-primary"
              : "bg-sidebar-accent text-sidebar-foreground group-hover:text-sidebar-foreground"
          )}>
            {TAB_CONFIG[tab].icon}
          </span>

          <span className="font-medium text-sm flex-1">{TAB_CONFIG[tab].label}</span>
          {(isReports || isSettings) && (
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-200",
              (isReports ? reportsExpanded : settingsExpanded) ? "rotate-180" : ""
            )} />
          )}
        </button>

        {/* Reports sub-menu */}
        {isReports && reportsExpanded && (
          <div className="ml-6 mt-1 mb-1 space-y-1 pl-4">
            {Object.entries(REPORTS_SUB_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setActiveTab("reports"); setReportSubTab(key); }}
                className={cn(
                  "w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  reportSubTab === key && activeTab === "reports"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                {cfg.icon && <span className="text-base">{cfg.icon}</span>}
                {cfg.label}
              </button>
            ))}
          </div>
        )}

        {/* Settings sub-menu */}
        {isSettings && settingsExpanded && (
          <div className="ml-6 mt-1 mb-1 space-y-1 pl-4">
            {Object.entries(SETTINGS_SUB_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => { setActiveTab("settings"); setSettingsSubTab(key); }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150",
                  settingsSubTab === key && activeTab === "settings"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {config.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const computeRiskText = (project: Project): string => {
    const today = new Date();
    const expectedGoLive = project.dates.expectedGoLiveDate ? new Date(project.dates.expectedGoLiveDate) : null;

    if (expectedGoLive && expectedGoLive < today && project.projectState !== "live") {
      const daysPast = Math.floor((today.getTime() - expectedGoLive.getTime()) / (1000 * 60 * 60 * 24));
      return `Go-live passed ${daysPast} day${daysPast !== 1 ? "s" : ""} ago`;
    }

    const activityDates: Date[] = [];
    project.checklist.forEach(c => {
      if (c.completedAt) activityDates.push(new Date(c.completedAt));
      if (c.commentAt) activityDates.push(new Date(c.commentAt));
    });
    project.transferHistory.forEach(t => {
      if (t.transferredAt) activityDates.push(new Date(t.transferredAt));
      if (t.acceptedAt) activityDates.push(new Date(t.acceptedAt));
    });

    const lastActivity = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map(d => d.getTime())))
      : (project.dates.kickOffDate ? new Date(project.dates.kickOffDate) : null);

    const daysSince = lastActivity
      ? Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (project.projectState === "blocked") {
      if (expectedGoLive) {
        const daysToGoLive = Math.floor((expectedGoLive.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToGoLive >= 0) return `Blocked ${daysSince} day${daysSince !== 1 ? "s" : ""}, go-live in ${daysToGoLive}`;
      }
      return `Blocked ${daysSince} day${daysSince !== 1 ? "s" : ""}`;
    }

    if (project.projectState === "on_hold" && daysSince > 7) {
      return `No movement in ${daysSince} day${daysSince !== 1 ? "s" : ""}`;
    }

    if (!project.assignedOwner && project.projectState !== "live") {
      const kickOff = project.dates.kickOffDate ? new Date(project.dates.kickOffDate) : null;
      if (kickOff) {
        const daysUnassigned = Math.floor((today.getTime() - kickOff.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUnassigned > 1) return `Unassigned for ${daysUnassigned} day${daysUnassigned !== 1 ? "s" : ""}`;
      }
    }

    return "—";
  };

  return (
    <div className="h-screen overflow-hidden bg-[hsl(var(--surface-2))] text-foreground flex">
      {/* Left Sidebar — collapsible */}
      <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col shrink-0 transition-all duration-300 relative",
        sidebarCollapsed ? "w-16" : "w-[212px]"
      )}>
        {/* Logo & Title */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">

            {appLabels.org_logo_url ? (
              <img src={appLabels.org_logo_url} alt="Logo" className={cn("rounded-xl object-contain shadow-lg ring-2 ring-primary/20", sidebarCollapsed ? "h-8 w-8" : "h-12 w-12")} />
            ) : (
              <div className={cn("rounded-xl gradient-primary flex items-center justify-center shadow-[var(--shadow-soft)]", sidebarCollapsed ? "h-8 w-8" : "h-11 w-11")}>
                <BarChart3 className={cn(sidebarCollapsed ? "h-4 w-4" : "h-5 w-5", "text-primary-foreground")} />

              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-semibold text-[16px] leading-tight text-sidebar-foreground truncate">{sidebarTitle}</h1>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {!sidebarCollapsed && (
            <p className="text-[11px] font-semibold text-sidebar-foreground uppercase tracking-widest mb-3 px-4">
              Navigation
            </p>
          )}
          <div className="space-y-1">
            {sidebarTabs.map((tab) => sidebarCollapsed ? (
              <button
                key={tab}
                onClick={() => {
                  if (tab === "reports") { setActiveTab("reports"); }
                  else if (tab === "settings") { setActiveTab("settings"); }
                  else { setActiveTab(tab); }
                }}
                className={cn(
                  "w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                )}
                title={TAB_CONFIG[tab]?.label}
              >
                {TAB_CONFIG[tab]?.icon}
              </button>
            ) : renderNavItem(tab))}
          </div>
        </nav>

        {/* Collapse/Expand arrow button - centered vertically */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{activeTabLabel}</h2>
            </div>
            {activeTab === "projects" ? (
              <span className="text-xs text-muted-foreground">
                {`${filteredProjects.length} project${filteredProjects.length !== 1 ? "s" : ""} found`}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "projects" && (
              <div className="flex items-center rounded-lg bg-muted/70 p-0.5">
                <Button
                  type="button"
                  variant={projectView === "kanban" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                  onClick={() => setProjectView("kanban")}
                  aria-pressed={projectView === "kanban"}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  Board
                </Button>
                <Button
                  type="button"
                  variant={projectView === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                  onClick={() => setProjectView("list")}
                  aria-pressed={projectView === "list"}
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button
                  type="button"
                  variant={projectView === "tracker" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs"
                  onClick={() => setProjectView("tracker")}
                  aria-pressed={projectView === "tracker"}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  Go-Live
                </Button>
              </div>
            )}
            {/* Search */}
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/40 border-border/50 focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button onClick={() => exportProjectsToCSV(projects, { teamLabels, stateLabels: stateLabelsFromCtx, responsibilityLabels, getLabel: (k: string) => appLabels[k] || k }, { fields: customFields, valuesMap: customValuesMap })} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              <Button onClick={() => setCsvDialogOpen(true)} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Project
              </Button>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-border/50">
              <ThemeToggle />
              <div className="flex items-center gap-2 pl-2 border-l border-border/50">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className="font-medium text-xs text-foreground truncate leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Manager</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto app-shell-surface">
          <div
            className={cn(
              ["projects", "reports", "settings", "calendar"].includes(activeTab)
                ? "p-0"
                : "p-8"
            )}
          >

          {/* ========= OVERVIEW TAB ========= */}
          {activeTab === "dashboard" && <div className="mx-auto max-w-7xl space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 gap-px bg-slate-200 lg:grid-cols-4">
              {(() => {
                const kpiCards = [
                  { label: "All projects", value: totalProjects, icon: FolderKanban, sub: "Across the portfolio", tone: "text-slate-700 bg-slate-100" },
                  { label: "Needs acceptance", value: pendingProjects, icon: AlertCircle, sub: "Waiting on a response", tone: "text-amber-700 bg-amber-100" },
                  { label: "In delivery", value: activeProjects, icon: Rocket, sub: `${blockedProjects} blocked · ${onHoldProjects} on hold`, tone: "text-sky-700 bg-sky-100" },
                  { label: "Live", value: completedProjects, icon: CheckCircle2, sub: `${liveArr.toFixed(2)} Cr realized`, tone: "text-emerald-700 bg-emerald-100" },
                ];
                return kpiCards.map((kpi) => (
                  <div key={kpi.label} className="group min-h-[136px] bg-white p-5 transition-colors hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{kpi.value}</p>
                        </div>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${kpi.tone}`}>
                          <kpi.icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{kpi.sub}</p>
                  </div>
                ));
              })()}
              </div>
            </section>

            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm xl:min-h-[306px]">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Team workload</p>
                    <p className="mt-0.5 text-xs text-slate-500">Current project ownership and completion status</p>
                  </div>
                  <Users className="h-5 w-5 text-sky-700" />
                </div>
                <div className="divide-y divide-slate-100">
                    {teamOwnerReport.map((team) => {
                      const teamProjects = displayProjects.filter(p => p.currentOwnerTeam === team.team);
                      const totalCount = teamProjects.length;
                      const pendingCount = teamProjects.filter(p => p.pendingAcceptance).length;
                      // A project is "completed" for a team if ALL that team's checklist items are done
                      const completedCount = teamProjects.filter(p => {
                        const teamItems = p.checklist.filter(c => c.ownerTeam === team.team);
                        return teamItems.length > 0 && teamItems.every(c => c.completed);
                      }).length;
                      const activeCount = totalCount - pendingCount - completedCount;
                      const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                      return (
                        <div key={team.team} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(170px,0.8fr)_minmax(260px,1.2fr)_120px] md:items-center">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${teamColors[team.team]} text-sm font-bold text-white`}>
                                {team.teamLabel.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{team.teamLabel}</p>
                                <p className="text-xs text-slate-500">{totalCount} owned projects</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-md bg-sky-50 px-2 py-2"><p className="text-base font-semibold text-sky-800">{activeCount}</p><p className="text-[10px] text-sky-700">active</p></div>
                              <div className="rounded-md bg-amber-50 px-2 py-2"><p className="text-base font-semibold text-amber-800">{pendingCount}</p><p className="text-[10px] text-amber-700">pending</p></div>
                              <div className="rounded-md bg-emerald-50 px-2 py-2"><p className="text-base font-semibold text-emerald-800">{completedCount}</p><p className="text-[10px] text-emerald-700">complete</p></div>
                            </div>
                            <div className="md:text-right">
                              <p className="text-lg font-semibold text-slate-900">{completionRate}%</p>
                              <p className="text-xs text-slate-500">completion</p>
                            </div>
                        </div>
                      );
                    })}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white shadow-sm xl:min-h-[306px]">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">TAT booklet</p>
                      <p className="mt-0.5 text-xs text-slate-500">Turnaround from kick-off to go-live target</p>
                    </div>
                    <Clock className="h-5 w-5 text-sky-700" />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-sky-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Average TAT</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-sky-900">{tatBooklet.averageElapsed}d</p>
                        <p className="mt-0.5 text-[10px] text-sky-700">elapsed</p>
                      </div>
                      <div className="rounded-md bg-slate-100 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Target TAT</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{tatBooklet.averageTarget}d</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">planned</p>
                      </div>
                      <div className="rounded-md bg-rose-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Overdue</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-900">{tatBooklet.overdueCount}</p>
                        <p className="mt-0.5 text-[10px] text-rose-700">projects</p>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {tatBooklet.byTeam.map((team) => (
                        <div key={team.team} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${teamColors[team.team]} text-[10px] font-bold text-white`}>{team.label.charAt(0)}</div>
                            <span className="truncate text-xs font-semibold text-slate-700">{team.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{team.averageElapsed}d <span className="font-normal text-slate-400">/ {team.averageTarget}d</span></span>
                          <span className={cn("text-[10px] font-semibold", team.overdueCount > 0 ? "text-rose-600" : "text-emerald-600")}>{team.overdueCount > 0 ? `${team.overdueCount} overdue` : "on track"}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Based on {tatBooklet.trackedCount} project{tatBooklet.trackedCount === 1 ? "" : "s"} with a kick-off date.</p>
                </div>
              </section>
            </div>

            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Delivery stages</p>
                    <p className="mt-0.5 text-xs text-slate-500">Where active project work is concentrated</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-sky-700" />
                </div>
                <div className="space-y-4 p-5">
                  <div className="space-y-4">
                    {(() => {
                      // Group projects by next incomplete checklist item title (from current owner team first)
                      const phaseGroups: Record<string, number> = {};
                      displayProjects.forEach(p => {
                        const teamItems = p.checklist.filter(c => c.ownerTeam === p.currentOwnerTeam);
                        const nextItem = teamItems.find(c => !c.completed) || p.checklist.find(c => !c.completed);
                        const label = nextItem ? nextItem.title : "All Complete";
                        phaseGroups[label] = (phaseGroups[label] || 0) + 1;
                      });
                      // Sort by count descending
                      const sorted = Object.entries(phaseGroups).sort((a, b) => b[1] - a[1]);
                      return sorted.map(([label, count]) => {
                        const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                        return (
                          <div key={label} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="max-w-[70%] truncate font-medium text-slate-700" title={label}>{label}</span>
                              <span className="whitespace-nowrap text-xs font-semibold text-slate-900">{count} · {pct}%</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Delivery health</p>
                    <p className="mt-0.5 text-xs text-slate-500">Project state distribution across the portfolio</p>
                  </div>
                  <Settings className="h-5 w-5 text-sky-700" />
                </div>
                <div className="space-y-4 p-5">
                    {(Object.keys(projectStateLabels) as ProjectState[]).map(state => {
                      const count = displayProjects.filter(p => p.projectState === state).length;
                      const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                      return (
                        <div key={state} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{stateLabelsFromCtx[state] || projectStateLabels[state]}</span>
                            <span className="text-xs font-semibold text-slate-900">{count} · {pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          </div>}

          {/* ========= PROJECTS TAB ========= */}
          {activeTab === "projects" && <div>
            {projectView === "tracker" ? (
              <MonthlyGoLiveTracker projects={filteredProjects} />
            ) : projectView === "kanban" ? (
              <div className="px-6 py-5">
                <KanbanBoard filteredProjects={filteredProjects} />
              </div>
            ) : (
            <Card className={cn("rounded-none border-x-0 border-t-0 border-border/50 shadow-none", projectView === "list" && "hidden")}>
              <CardHeader className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 relative">
                    <CardTitle className="text-lg flex items-center gap-3">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={() => toggleSelectAll(filteredProjectIds)}
                        className="h-5 w-5"
                      />
                      <span className="text-base font-medium">All Projects</span>
                    </CardTitle>
                    {/* Sort Dropdown - left side */}
                    <Collapsible open={sortOpen} onOpenChange={setSortOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <ArrowUpDown className="h-4 w-4" />
                          Sort
                          {sortField !== "none" && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">1</Badge>}
                          <ChevronDown className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="absolute left-0 top-full z-20 mt-2 w-[320px] space-y-3 rounded-lg border bg-card p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">Sort By</p>
                          {sortField !== "none" && (
                            <Button variant="ghost" size="sm" onClick={() => { setSortField("none"); setSortDirection("asc"); }} className="text-xs h-7">Clear</Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Field</label>
                            <Select value={sortField} onValueChange={setSortField}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="arr">ARR</SelectItem>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="phase">Phase</SelectItem>
                                <SelectItem value="platform">Platform</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Direction</label>
                            <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as "asc" | "desc")}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="asc">Ascending</SelectItem>
                                <SelectItem value="desc">Descending</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end border-t pt-3">
                          <Button size="sm" onClick={() => setSortOpen(false)}>Done</Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    {/* Filters - left side */}
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Search className="h-4 w-4" />
                          Filters
                          {hasActiveFilters && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>}
                          <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="absolute left-0 top-full z-20 mt-2 w-[600px] space-y-3 rounded-lg border bg-card p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">Filters</p>
                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">Clear All</Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {renderMultiFilter({
                            label: "Team",
                            selected: teamFilter,
                            allLabel: "All Teams",
                            singularLabel: "team",
                            summary: teamFilter.length === 1 ? (teamLabels[teamFilter[0] as TeamRole] || teamFilter[0]) : undefined,
                            options: [
                              { value: "mint", label: teamLabels.mint },
                              { value: "integration", label: teamLabels.integration },
                              { value: "ms", label: teamLabels.ms },
                            ],
                            onToggle: (value, checked) => {
                              setTeamFilter((prev) => applyMultiToggle(prev, value, checked));
                              setOwnerFilter([]);
                            },
                            onClear: () => {
                              setTeamFilter([]);
                              setOwnerFilter([]);
                            },
                          })}
                          {renderMultiFilter({
                            label: "Owner",
                            selected: ownerFilter,
                            allLabel: "All Owners",
                            singularLabel: "owner",
                            summary: ownerFilter.length === 1 ? (filteredOwners.find((o) => o.id === ownerFilter[0])?.name || ownerFilter[0]) : undefined,
                            options: filteredOwners.map((owner) => ({ value: owner.id, label: owner.name })),
                            onToggle: (value, checked) => setOwnerFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setOwnerFilter([]),
                          })}
                          {renderMultiFilter({
                            label: "Phase",
                            selected: phaseFilter,
                            allLabel: "All Phases",
                            singularLabel: "phase",
                            options: uniquePhaseLabels.map((label) => ({ value: label, label })),
                            onToggle: (value, checked) => setPhaseFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setPhaseFilter([]),
                          })}
                          {renderMultiFilter({
                            label: "State",
                            selected: stateFilter,
                            allLabel: "All States",
                            singularLabel: "state",
                            summary: stateFilter.length === 1 ? (stateLabelsFromCtx[stateFilter[0] as ProjectState] || projectStateLabels[stateFilter[0] as ProjectState] || stateFilter[0]) : undefined,
                            options: (Object.keys(projectStateLabels) as ProjectState[]).map((s) => ({ value: s, label: stateLabelsFromCtx[s] || projectStateLabels[s] })),
                            onToggle: (value, checked) => setStateFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setStateFilter([]),
                          })}
                          {renderMultiFilter({
                            label: "Platform",
                            selected: platformFilter,
                            allLabel: "All Platforms",
                            singularLabel: "platform",
                            options: uniquePlatforms.map((platform) => ({ value: platform, label: platform })),
                            onToggle: (value, checked) => setPlatformFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setPlatformFilter([]),
                          })}
                          {renderMultiFilter({
                            label: "Category",
                            selected: categoryFilter,
                            allLabel: "All Categories",
                            singularLabel: "category",
                            options: uniqueCategories.map((category) => ({ value: category, label: category })),
                            onToggle: (value, checked) => setCategoryFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setCategoryFilter([]),
                          })}
                          {renderMultiFilter({
                            label: "Responsibility",
                            selected: responsibilityFilter,
                            allLabel: "All",
                            singularLabel: "responsibility",
                            summary: responsibilityFilter.length === 1 ? (responsibilityLabels[responsibilityFilter[0] as "gokwik" | "merchant" | "neutral"] || responsibilityFilter[0]) : undefined,
                            options: [
                              { value: "gokwik", label: responsibilityLabels.gokwik },
                              { value: "merchant", label: responsibilityLabels.merchant },
                              { value: "neutral", label: "Neutral" },
                            ],
                            onToggle: (value, checked) => setResponsibilityFilter((prev) => applyMultiToggle(prev, value, checked)),
                            onClear: () => setResponsibilityFilter([]),
                          })}
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">ARR Range (Cr)</label>
                            <div className="flex gap-1">
                              <Input type="number" placeholder="Min" value={arrMin} onChange={e => setArrMin(e.target.value)} className="w-full h-9 text-xs" />
                              <Input type="number" placeholder="Max" value={arrMax} onChange={e => setArrMax(e.target.value)} className="w-full h-9 text-xs" />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                          <div className="space-y-1 border rounded-md p-3 overflow-hidden">
                            <label className="text-xs text-muted-foreground font-medium">Start Date Range</label>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                              <Input type="date" value={kickOffFrom} onChange={e => setKickOffFrom(e.target.value)} className="h-9 text-xs min-w-0" />
                              <span className="text-xs text-muted-foreground px-1">to</span>
                              <Input type="date" value={kickOffTo} onChange={e => setKickOffTo(e.target.value)} className="h-9 text-xs min-w-0" />
                            </div>
                          </div>
                          <div className="space-y-1 border rounded-md p-3 overflow-hidden">
                            <label className="text-xs text-muted-foreground font-medium">Go-Live Date Range</label>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                              <Input type="date" value={goLiveFrom} onChange={e => setGoLiveFrom(e.target.value)} className="h-9 text-xs min-w-0" />
                              <span className="text-xs text-muted-foreground px-1">to</span>
                              <Input type="date" value={goLiveTo} onChange={e => setGoLiveTo(e.target.value)} className="h-9 text-xs min-w-0" />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end border-t pt-3">
                          <Button size="sm" onClick={() => setFiltersOpen(false)}>Done</Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    {selectedProjects.size > 0 && (
                      <Badge variant="secondary" className="text-sm">{selectedProjects.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 relative">
                    {selectedProjects.size > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Bulk Actions ({selectedProjects.size})
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute z-20 mt-2 right-0 bg-card border rounded-lg shadow-xl p-3 space-y-1 min-w-[200px]">
                          <Button variant="ghost" className="w-full justify-start gap-2 h-9" onClick={() => setBulkAssignDialogOpen(true)}>
                            <UserPlus className="h-4 w-4" />
                            Assign Owner
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 h-9" onClick={() => setBulkEditDialogOpen(true)}>
                            <Pencil className="h-4 w-4" />
                            Bulk Edit
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 h-9" onClick={() => setBulkStateDialogOpen(true)}>
                            <RefreshCw className="h-4 w-4" />
                            Update State
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-destructive hover:text-destructive" onClick={() => setBulkDeleteDialogOpen(true)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              </CardHeader>
               <CardContent className="p-0">
                  <div className="px-4 py-4 space-y-3">
                    {(() => {
                      const sortedProjects = sortField === "none" ? filteredProjects : [...filteredProjects].sort((a, b) => {
                        let cmp = 0;
                        switch (sortField) {
                          case "arr": cmp = a.arr - b.arr; break;
                          case "owner": cmp = (a.assignedOwnerName || "").localeCompare(b.assignedOwnerName || ""); break;
                          case "phase": cmp = getProjectPhaseLabel(a).localeCompare(getProjectPhaseLabel(b)); break;
                          case "platform": cmp = (a.platform || "").localeCompare(b.platform || ""); break;
                        }
                        return sortDirection === "desc" ? -cmp : cmp;
                      });
                      return (
                        <>
                    {sortedProjects.length === 0 ? (
                      <div className="text-center py-20">
                        <FolderKanban className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Projects Found</h3>
                        <p className="text-muted-foreground">Try adjusting your filters or add a new project.</p>
                      </div>
                    ) : (
                      sortedProjects.map((project) => (
                        <div key={project.id} className="flex items-start gap-2.5">
                          <div className="pt-3">
                            <Checkbox checked={selectedProjects.has(project.id)} onCheckedChange={() => toggleProjectSelection(project.id)} />
                          </div>
                          <div className="flex-1">
                            <ProjectCardNew project={project} />
                          </div>
                        </div>
                      ))
                    )}
                        </>
                      );
                    })()}
                  </div>
              </CardContent>
            </Card>
            )}
          </div>}

          {/* ========= LIST VIEW TAB ========= */}
          {activeTab === "projects" && projectView === "list" && <div className="space-y-4">
            <Card className="border-border/60 bg-card/90 enterprise-shadow">
              <CardHeader className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <List className="h-5 w-5 text-primary" />
                    List View
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/35 px-2 py-1.5">
                      <Checkbox
                        checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? "indeterminate" : false}
                        onCheckedChange={() => toggleSelectAll(filteredProjectIds)}
                        aria-label="Select all filtered projects"
                      />
                      <span className="text-xs text-muted-foreground">
                        {selectedFilteredCount > 0 ? `${selectedFilteredCount} selected` : "Select all"}
                      </span>
                    </div>
                    {selectedFilteredCount > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Bulk Actions ({selectedFilteredCount})
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <button className="w-full text-left px-2 py-2 text-sm hover:bg-accent rounded-sm" onClick={() => setBulkAssignDialogOpen(true)}>
                            Assign Owner
                          </button>
                          <button className="w-full text-left px-2 py-2 text-sm hover:bg-accent rounded-sm" onClick={() => setBulkEditDialogOpen(true)}>
                            Bulk Edit
                          </button>
                          <button className="w-full text-left px-2 py-2 text-sm hover:bg-accent rounded-sm" onClick={() => setBulkStateDialogOpen(true)}>
                            Update State
                          </button>
                          <button className="w-full text-left px-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-sm" onClick={() => setBulkDeleteDialogOpen(true)}>
                            Delete
                          </button>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <div className="relative">
                      <DropdownMenu open={listColumnsOpen} onOpenChange={setListColumnsOpen}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <List className="h-4 w-4" />
                            Select Columns
                            <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">
                              {listViewColumns.length}
                            </Badge>
                            <ChevronDown className={cn("h-3 w-3 transition-transform", listColumnsOpen && "rotate-180")} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-0">
                          <DropdownMenuLabel className="pb-1">Visible Columns</DropdownMenuLabel>
                          <p className="px-2 pb-2 text-[11px] text-muted-foreground">Drag to reorder active columns</p>
                          <DropdownMenuSeparator />
                          <div className="max-h-[340px] overflow-y-auto p-1">
                            {/* Active columns - draggable to reorder */}
                            {listViewColumns.length > 0 && (
                              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active</p>
                            )}
                            {listViewColumns.map((colKey, idx) => {
                              const col = LIST_VIEW_COLUMNS.find(c => c.key === colKey);
                              if (!col) return null;
                              return (
                                <div
                                  key={col.key}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData("col-idx", String(idx)); }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIdx = parseInt(e.dataTransfer.getData("col-idx"));
                                    if (isNaN(fromIdx) || fromIdx === idx) return;
                                    const newCols = [...listViewColumns];
                                    const [moved] = newCols.splice(fromIdx, 1);
                                    newCols.splice(idx, 0, moved);
                                    setListViewColumns(newCols);
                                    localStorage.setItem("listview_columns", JSON.stringify(newCols));
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-grab hover:bg-accent/50 rounded-md transition-colors"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                  <Checkbox
                                    checked={true}
                                    onCheckedChange={() => {
                                      const newCols = listViewColumns.filter((key) => key !== col.key);
                                      setListViewColumns(newCols);
                                      localStorage.setItem("listview_columns", JSON.stringify(newCols));
                                    }}
                                    aria-label={`Toggle ${col.label}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCols = listViewColumns.filter((key) => key !== col.key);
                                      setListViewColumns(newCols);
                                      localStorage.setItem("listview_columns", JSON.stringify(newCols));
                                    }}
                                    className="flex-1 text-left hover:text-foreground"
                                  >
                                    {col.label}
                                  </button>
                                </div>
                              );
                            })}
                            {/* Inactive columns */}
                            {LIST_VIEW_COLUMNS.some(col => !listViewColumns.includes(col.key)) && (
                              <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hidden</p>
                            )}
                            {LIST_VIEW_COLUMNS.filter(col => !listViewColumns.includes(col.key)).map((col) => (
                              <div key={col.key} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/40">
                                <div className="w-3.5 shrink-0" />
                                <Checkbox
                                  checked={false}
                                  onCheckedChange={() => {
                                    const newCols = [...listViewColumns, col.key];
                                    setListViewColumns(newCols);
                                    localStorage.setItem("listview_columns", JSON.stringify(newCols));
                                  }}
                                  aria-label={`Toggle ${col.label}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCols = [...listViewColumns, col.key];
                                    setListViewColumns(newCols);
                                    localStorage.setItem("listview_columns", JSON.stringify(newCols));
                                  }}
                                  className="flex-1 text-left text-muted-foreground"
                                >
                                  {col.label}
                                </button>
                              </div>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="relative">
                      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Search className="h-4 w-4" />
                            Filters
                            {hasActiveFilters && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>}
                            <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute right-0 top-full z-20 mt-2 w-[600px] space-y-3 rounded-lg border bg-card p-4 shadow-xl">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">Filters</p>
                            {hasActiveFilters && (
                              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">Clear All</Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {renderMultiFilter({
                              label: "Team",
                              selected: teamFilter,
                              allLabel: "All Teams",
                              singularLabel: "team",
                              summary: teamFilter.length === 1 ? (teamLabels[teamFilter[0] as TeamRole] || teamFilter[0]) : undefined,
                              options: [
                                { value: "mint", label: teamLabels.mint },
                                { value: "integration", label: teamLabels.integration },
                                { value: "ms", label: teamLabels.ms },
                              ],
                              onToggle: (value, checked) => {
                                setTeamFilter((prev) => applyMultiToggle(prev, value, checked));
                                setOwnerFilter([]);
                              },
                              onClear: () => {
                                setTeamFilter([]);
                                setOwnerFilter([]);
                              },
                            })}
                            {renderMultiFilter({
                              label: "Owner",
                              selected: ownerFilter,
                              allLabel: "All Owners",
                              singularLabel: "owner",
                              summary: ownerFilter.length === 1 ? (filteredOwners.find((o) => o.id === ownerFilter[0])?.name || ownerFilter[0]) : undefined,
                              options: filteredOwners.map((owner) => ({ value: owner.id, label: owner.name })),
                              onToggle: (value, checked) => setOwnerFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setOwnerFilter([]),
                            })}
                            {renderMultiFilter({
                              label: "Phase",
                              selected: phaseFilter,
                              allLabel: "All Phases",
                              singularLabel: "phase",
                              options: uniquePhaseLabels.map((label) => ({ value: label, label })),
                              onToggle: (value, checked) => setPhaseFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setPhaseFilter([]),
                            })}
                            {renderMultiFilter({
                              label: "State",
                              selected: stateFilter,
                              allLabel: "All States",
                              singularLabel: "state",
                              summary: stateFilter.length === 1 ? (stateLabelsFromCtx[stateFilter[0] as ProjectState] || projectStateLabels[stateFilter[0] as ProjectState] || stateFilter[0]) : undefined,
                              options: (Object.keys(projectStateLabels) as ProjectState[]).map((s) => ({ value: s, label: stateLabelsFromCtx[s] || projectStateLabels[s] })),
                              onToggle: (value, checked) => setStateFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setStateFilter([]),
                            })}
                            {renderMultiFilter({
                              label: "Platform",
                              selected: platformFilter,
                              allLabel: "All Platforms",
                              singularLabel: "platform",
                              options: uniquePlatforms.map((platform) => ({ value: platform, label: platform })),
                              onToggle: (value, checked) => setPlatformFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setPlatformFilter([]),
                            })}
                            {renderMultiFilter({
                              label: "Category",
                              selected: categoryFilter,
                              allLabel: "All Categories",
                              singularLabel: "category",
                              options: uniqueCategories.map((category) => ({ value: category, label: category })),
                              onToggle: (value, checked) => setCategoryFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setCategoryFilter([]),
                            })}
                            {renderMultiFilter({
                              label: "Responsibility",
                              selected: responsibilityFilter,
                              allLabel: "All",
                              singularLabel: "responsibility",
                              summary: responsibilityFilter.length === 1 ? (responsibilityLabels[responsibilityFilter[0] as "gokwik" | "merchant" | "neutral"] || responsibilityFilter[0]) : undefined,
                              options: [
                                { value: "gokwik", label: responsibilityLabels.gokwik },
                                { value: "merchant", label: responsibilityLabels.merchant },
                                { value: "neutral", label: "Neutral" },
                              ],
                              onToggle: (value, checked) => setResponsibilityFilter((prev) => applyMultiToggle(prev, value, checked)),
                              onClear: () => setResponsibilityFilter([]),
                            })}
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground font-medium">ARR Range (Cr)</label>
                              <div className="flex gap-1">
                                <Input type="number" placeholder="Min" value={arrMin} onChange={e => setArrMin(e.target.value)} className="w-full h-9 text-xs" />
                                <Input type="number" placeholder="Max" value={arrMax} onChange={e => setArrMax(e.target.value)} className="w-full h-9 text-xs" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                            <div className="space-y-1 border rounded-md p-3 overflow-hidden">
                              <label className="text-xs text-muted-foreground font-medium">Start Date Range</label>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                                <Input type="date" value={kickOffFrom} onChange={e => setKickOffFrom(e.target.value)} className="h-9 text-xs min-w-0" />
                                <span className="text-xs text-muted-foreground px-1">to</span>
                                <Input type="date" value={kickOffTo} onChange={e => setKickOffTo(e.target.value)} className="h-9 text-xs min-w-0" />
                              </div>
                            </div>
                            <div className="space-y-1 border rounded-md p-3 overflow-hidden">
                              <label className="text-xs text-muted-foreground font-medium">Go-Live Date Range</label>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                                <Input type="date" value={goLiveFrom} onChange={e => setGoLiveFrom(e.target.value)} className="h-9 text-xs min-w-0" />
                                <span className="text-xs text-muted-foreground px-1">to</span>
                                <Input type="date" value={goLiveTo} onChange={e => setGoLiveTo(e.target.value)} className="h-9 text-xs min-w-0" />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end border-t pt-3">
                            <Button size="sm" onClick={() => setFiltersOpen(false)}>Done</Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <div className="relative">
                      <Collapsible open={sortOpen} onOpenChange={setSortOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <ArrowUpDown className="h-4 w-4" />
                            Sort
                            {sortField !== "none" && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">1</Badge>}
                            <ChevronDown className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute right-0 top-full z-20 mt-2 w-[320px] space-y-3 rounded-lg border bg-card p-4 shadow-xl">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">Sort By</p>
                            {sortField !== "none" && (
                              <Button variant="ghost" size="sm" onClick={() => { setSortField("none"); setSortDirection("asc"); }} className="text-xs h-7">Clear</Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground font-medium">Field</label>
                              <Select value={sortField} onValueChange={setSortField}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="arr">ARR</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                  <SelectItem value="phase">Phase</SelectItem>
                                  <SelectItem value="platform">Platform</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground font-medium">Direction</label>
                              <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as "asc" | "desc")}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="asc">Ascending</SelectItem>
                                  <SelectItem value="desc">Descending</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-end border-t pt-3">
                            <Button size="sm" onClick={() => setSortOpen(false)}>Done</Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
                    </span>
                    <Select value={String(listViewPageSize)} onValueChange={(v) => { setListViewPageSize(Number(v)); setListViewPage(1); }}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / Page</SelectItem>
                        <SelectItem value="25">25 / Page</SelectItem>
                        <SelectItem value="50">50 / Page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <Table className="border-separate border-spacing-y-1">
                    <TableHeader className="sticky top-0 z-10 bg-muted/75 backdrop-blur-sm">
                      <TableRow className="border-b-2 border-border/60 hover:bg-transparent">
                        <TableHead className="w-10 py-3 pl-3 pr-0">
                          <Checkbox
                            checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? "indeterminate" : false}
                            onCheckedChange={() => toggleSelectAll(filteredProjectIds)}
                            aria-label="Select all filtered projects"
                          />
                        </TableHead>
                        {listViewColumns.map((colKey, colIdx) => {
                          const col = LIST_VIEW_COLUMNS.find(c => c.key === colKey);
                          return col ? (
                            <TableHead
                              key={colKey}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData("th-idx", String(colIdx)); }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const fromIdx = parseInt(e.dataTransfer.getData("th-idx"));
                                if (isNaN(fromIdx) || fromIdx === colIdx) return;
                                const newCols = [...listViewColumns];
                                const [moved] = newCols.splice(fromIdx, 1);
                                newCols.splice(colIdx, 0, moved);
                                setListViewColumns(newCols);
                                localStorage.setItem("listview_columns", JSON.stringify(newCols));
                              }}
                              className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3 cursor-grab select-none"
                            >
                              <span className="flex items-center gap-1">
                                <GripVertical className="h-3 w-3 opacity-40" />
                                {col.label}
                              </span>
                            </TableHead>
                          ) : null;
                        })}
                        <TableHead className="w-16 text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr]:mb-1">
                      {(() => {
                        const sortedListProjects = sortField === "none" ? filteredProjects : [...filteredProjects].sort((a, b) => {
                          let cmp = 0;
                          switch (sortField) {
                            case "arr": cmp = a.arr - b.arr; break;
                            case "owner": cmp = (a.assignedOwnerName || "").localeCompare(b.assignedOwnerName || ""); break;
                            case "phase": cmp = getProjectPhaseLabel(a).localeCompare(getProjectPhaseLabel(b)); break;
                            case "platform": cmp = (a.platform || "").localeCompare(b.platform || ""); break;
                          }
                          return sortDirection === "desc" ? -cmp : cmp;
                        });
                        const paged = sortedListProjects.slice((listViewPage - 1) * listViewPageSize, listViewPage * listViewPageSize);
                        return paged.map(project => {
                          const getColValue = (key: string) => {
                            switch (key) {
                              case "merchantName": return project.merchantName;
                              case "mid": return project.mid;
                              case "platform": return project.platform || "—";
                              case "category": return project.category || "—";
                              case "merchantState": return getProjectPhaseLabel(project);
                              case "phase": return phaseLabels[project.currentPhase] || project.currentPhase;
                              case "responsibility": return responsibilityLabels[project.currentResponsibility] || project.currentResponsibility;
                              case "checklist": return `${project.checklist.filter(c => c.completed).length}/${project.checklist.length} checklist`;
                              case "txnsPerDay": return `${project.txnsPerDay}`;
                              case "aov": return `${project.aov}`;
                              case "pendingAcceptance": return project.pendingAcceptance ? "Yes" : "No";
                              case "mintComment": return project.notes?.currentPhaseComment || project.notes?.mintNotes || "—";
                              case "mintNotes": return project.notes?.mintNotes || "—";
                              case "projectNotes": return project.notes?.projectNotes || "—";
                              case "currentPhaseComment": return project.notes?.currentPhaseComment || "—";
                              case "liveDate": return project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—";
                              case "brandUrl": return project.links?.brandUrl || "—";
                              case "jiraLink": return project.links?.jiraLink || "—";
                              case "brdLink": return project.links?.brdLink || "—";
                              case "transferCount": return `${project.transferHistory.length}`;
                              case "recentComments": {
                                const comments = project.checklist
                                  .filter(c => c.comment)
                                  .sort((a, b) => (b.commentAt || "").localeCompare(a.commentAt || ""))
                                  .slice(0, 3)
                                  .map(c => `${c.commentAt?.slice(0, 10) || "NA"} : ${c.comment?.slice(0, 30)}...`);
                                return comments.length > 0 ? comments.join("\n") : "—";
                              }
                              case "status": return stateLabelsFromCtx[project.projectState] || projectStateLabels[project.projectState];
                              case "arr": return `${project.arr}`;
                              case "owner": return project.assignedOwnerName || "Unassigned";
                              case "salesSpoc": return project.salesSpoc || "—";
                              case "kickOffDate": return project.dates.kickOffDate;
                              case "goLiveDate": return project.dates.goLiveDate || project.dates.expectedGoLiveDate || "—";
                              case "integrationType": return project.integrationType || "—";
                              case "pgOnboarding": return project.pgOnboarding || "—";
                              case "goLivePercent": return `${project.goLivePercent || 0}%`;
                              case "risk": {
                                const health = computeHealthScore(project);
                                return health.label === "Healthy" ? "—" : health.factors[0] || health.label;
                              }
                              default: return "—";
                            }
                          };


                          const riskText = computeRiskText(project);
                          const riskIsCritical = riskText.includes("passed") || riskText.startsWith("Blocked");
                          const goLiveRaw = project.dates.goLiveDate || project.dates.expectedGoLiveDate;
                          const isLive = project.projectState === "live";
                          const goLiveDate = goLiveRaw ? new Date(goLiveRaw) : null;
                          const goLiveIsPast = goLiveDate && goLiveDate < new Date() && !isLive;
                          const goLiveDisplay = goLiveDate
                            ? goLiveDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "—";

                          return (
                            <TableRow
                              key={project.id}
                              className="cursor-pointer border-b border-border/45 bg-card/90 transition-colors hover:bg-accent/35 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                              onClick={() => openProjectWorkspaceTab(project.id)}
                            >
                              <TableCell className="w-10 py-3 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedProjects.has(project.id)}
                                  onCheckedChange={(checked) => {
                                    const next = new Set(selectedProjects);
                                    checked ? next.add(project.id) : next.delete(project.id);
                                    setSelectedProjects(next);
                                  }}
                                />
                              </TableCell>
                              {listViewColumns.map(colKey => {
                                const rawValue = getColValue(colKey);
                                if (colKey === "merchantName") {
                                  return (
                                    <TableCell key={colKey} className="py-3">
                                      <span className="font-semibold text-sm text-foreground">{project.merchantName}</span>
                                      <span className="ml-2 text-xs text-muted-foreground">{project.mid}</span>
                                    </TableCell>
                                  );
                                }
                                if (colKey === "status") {
                                  return (
                                    <TableCell key={colKey} className="py-3">
                                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", projectStateColors[project.projectState])}>
                                        {stateLabelsFromCtx[project.projectState] || projectStateLabels[project.projectState]}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (colKey === "goLiveDate") {
                                  return (
                                    <TableCell key={colKey} className="py-3">
                                      <span className={cn("text-sm", isLive && "text-emerald-600 font-medium", goLiveIsPast && "text-destructive font-semibold")}>
                                        {goLiveRaw ? (isLive ? `Live ${goLiveDisplay}` : goLiveDisplay) : "—"}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (colKey === "risk") {
                                  return (
                                    <TableCell key={colKey} className="py-3">
                                      <span className={cn("text-sm", riskText === "—" ? "text-muted-foreground" : riskIsCritical ? "text-destructive font-medium" : "text-amber-600 font-medium")}>
                                        {riskText}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (colKey === "recentComments") {
                                  return (
                                    <TableCell key={colKey} className="py-3 max-w-[200px]">
                                      <div className="space-y-0.5">
                                        {rawValue.split("\n").map((line, i) => (
                                          <div key={i} className="text-xs text-muted-foreground truncate">{line}</div>
                                        ))}
                                      </div>
                                    </TableCell>
                                  );
                                }
                                if (colKey === "mintComment") {
                                  return (
                                    <TableCell key={colKey} className="py-3">
                                      <span className="truncate block max-w-[180px] text-sm" title={rawValue}>{rawValue}</span>
                                    </TableCell>
                                  );
                                }
                                return (
                                  <TableCell key={colKey} className="text-sm py-3 text-foreground">
                                    {rawValue}
                                  </TableCell>
                                );
                              })}
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {filteredProjects.length > listViewPageSize && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={listViewPage <= 1} onClick={() => setListViewPage(p => p - 1)} className="h-8 w-8 p-0">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: Math.ceil(filteredProjects.length / listViewPageSize) }, (_, i) => i + 1).slice(0, 5).map(page => (
                        <Button key={page} variant={listViewPage === page ? "default" : "outline"} size="sm" onClick={() => setListViewPage(page)} className="h-8 w-8 p-0 text-xs">
                          {page}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" disabled={listViewPage >= Math.ceil(filteredProjects.length / listViewPageSize)} onClick={() => setListViewPage(p => p + 1)} className="h-8 w-8 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>}

          {activeTab === "calendar" && <div className="space-y-6">
            <ProjectCalendar />
          </div>}

          {/* ========= REPORTS TAB ========= */}
          {activeTab === "reports" && <div className="space-y-6">
            <Card className="shadow-xl border-border/50">
              <CardContent className="p-0">
                <div className="p-6">
                  {/* Sub-tab: Pre Defined */}
                  {reportSubTab === "predefined" && (
                    <div className="space-y-4">
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: "executive", label: "Executive" },
                          { key: "operational", label: "Operational" },
                          { key: "merchant", label: responsibilityLabels.merchant },
                          { key: "tactical", label: "Tactical" },
                          { key: "project", label: "Project & Checklist" },
                          { key: "team", label: "Team & Owner" },
                        ].map(({ key, label }) => (
                          <Button key={key} variant={reportType === key ? "default" : "outline"} size="sm" onClick={() => setReportType(key)}>
                            {label}
                          </Button>
                        ))}
                      </div>
                      {reportType === "executive" && <ExecutiveDashboard projects={displayProjects} />}
                      {reportType === "operational" && <OperationalReports projects={displayProjects} />}
                      {reportType === "merchant" && <MerchantResponsibility projects={displayProjects} />}
                      {reportType === "tactical" && <TacticalLists projects={displayProjects} />}

                    {/* Merged Project + Checklist Report */}
                    {reportType === "project" && (
                      <div className="space-y-3">
                        {projectChecklistReport.map((project) => (
                          <Collapsible key={project.id} open={expandedProjects.has(project.id)} onOpenChange={() => toggleProjectExpand(project.id)}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  {expandedProjects.has(project.id) ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                  <div>
                                    <span className="font-semibold">{project.merchantName}</span>
                                    <span className="text-xs text-muted-foreground ml-2">({project.mid})</span>
                                    <span className="text-xs text-muted-foreground ml-2">Start: {project.dates.kickOffDate}</span>
                                  </div>
                                  <Badge variant="outline">{teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam}</Badge>
                                  <Badge variant="secondary">{project.stats.completedChecklist}/{project.stats.totalChecklist} tasks</Badge>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right text-sm">
                                    <span className="text-primary font-medium">{formatDuration(project.stats.projectTime.gokwik)}</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-amber-500 font-medium">{formatDuration(project.stats.projectTime.merchant)}</span>
                                  </div>
                                  <div className="w-24">
                                    <Progress value={project.stats.checklistProgress} className="h-2" />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{project.stats.checklistProgress}%</span>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 ml-8 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-muted/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{teamLabels.mint} Tasks</p>
                                    <p className="font-semibold">{project.mintCompleted}/{project.mintTotal}</p>
                                  </div>
                                  <div className="bg-muted/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{teamLabels.integration} Tasks</p>
                                    <p className="font-semibold">{project.integrationCompleted}/{project.integrationTotal}</p>
                                  </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Checklist Item</TableHead>
                                        <TableHead>Phase</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Responsibility</TableHead>
                                        <TableHead>{responsibilityLabels.gokwik} Time</TableHead>
                                        <TableHead>{responsibilityLabels.merchant} Time</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {project.checklistItems.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.checklistTitle}</TableCell>
                                          <TableCell>{phaseLabels[item.phase] || item.phase}</TableCell>
                                          <TableCell><Badge variant="outline">{teamLabels[item.team] || item.team}</Badge></TableCell>
                                          <TableCell>{responsibilityLabels[item.responsibility] || item.responsibility}</TableCell>
                                          <TableCell>{formatDuration(item.gokwikTime)}</TableCell>
                                          <TableCell>{formatDuration(item.merchantTime)}</TableCell>
                                          <TableCell>
                                            {item.completed ? (
                                              <Badge className="bg-emerald-500/10 text-emerald-600">Done</Badge>
                                            ) : (
                                              <Badge variant="secondary">Pending</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}

                    {/* Merged Team + Owner Report */}
                    {reportType === "team" && (
                      <div className="space-y-6">
                        {teamOwnerReport.map((team) => (
                          <Card key={team.team} className="bg-muted/30">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`h-12 w-12 rounded-xl ${teamColors[team.team]} flex items-center justify-center text-white font-bold text-lg`}>
                                    {team.teamLabel.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-lg">{team.teamLabel}</p>
                                    <p className="text-sm text-muted-foreground">{team.projectCount} projects</p>
                                  </div>
                                </div>
                                {team.pendingCount > 0 && (
                                  <Badge className="bg-amber-500 text-white">{team.pendingCount} Pending</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold">{team.projectCount}</p>
                                  <p className="text-xs text-muted-foreground">Projects</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold">{team.completedTasks}/{team.totalTasks}</p>
                                  <p className="text-xs text-muted-foreground">Tasks</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold text-primary">{formatDuration(team.gokwikTime)}</p>
                                  <p className="text-xs text-muted-foreground">{responsibilityLabels.gokwik}</p>
                                </div>
                                <div className="bg-background rounded-lg p-4 text-center">
                                  <p className="text-2xl font-bold text-amber-500">{formatDuration(team.merchantTime)}</p>
                                  <p className="text-xs text-muted-foreground">{responsibilityLabels.merchant}</p>
                                </div>
                              </div>
                              {team.owners.length > 0 && (
                                <div>
                                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Owners in {team.teamLabel}
                                  </p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Projects</TableHead>
                                        <TableHead>Tasks</TableHead>
                                        <TableHead>{responsibilityLabels.gokwik} Time</TableHead>
                                        <TableHead>{responsibilityLabels.merchant} Time</TableHead>
                                        <TableHead>Project Names</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {team.owners.map((owner) => (
                                        <TableRow key={owner.ownerId}>
                                          <TableCell className="font-medium">{owner.ownerName}</TableCell>
                                          <TableCell>{owner.totalProjects}</TableCell>
                                          <TableCell>{owner.completedTasks}/{owner.totalTasks}</TableCell>
                                          <TableCell>{formatDuration(owner.gokwikTime)}</TableCell>
                                          <TableCell>{formatDuration(owner.merchantTime)}</TableCell>
                                          <TableCell className="max-w-[200px]">
                                            <span className="text-xs text-muted-foreground truncate block">
                                              {owner.projectNames.join(", ")}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    </div>
                  )}

                  {/* Sub-tab: Report Builder */}
                  {reportSubTab === "builder" && (
                    <ReportsBuilder projects={displayProjects} customFields={customFields} customValuesMap={customValuesMap} />
                  )}

                  {/* Sub-tab: Scheduler */}
                  {reportSubTab === "scheduler" && (
                    <ReportScheduler />
                  )}

                  {/* Sub-tab: AI Movement Report */}
                  {reportSubTab === "movement" && (
                    <MovementReport />
                  )}

                </div>
              </CardContent>
            </Card>
          </div>}

          {/* Settings Tab */}
          {activeTab === "settings" && <div className="space-y-6">
            {settingsSubTab === "navigation" ? (
              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Navigation Visibility
                  </CardTitle>
                  <CardDescription>Enable or disable navigation items for the sidebar</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {ALL_NAV_ITEMS.map((navKey) => {
                      const isLocked = navKey === "settings";
                      return (
                        <div key={navKey} className={cn("flex items-center justify-between p-3 border rounded-lg", isLocked && "bg-muted/40")}>
                          <div className="flex items-center gap-2">
                            {TAB_CONFIG[navKey]?.icon}
                            <span className="text-sm font-medium">{TAB_CONFIG[navKey]?.label || navKey}</span>
                            {isLocked && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Always Visible</Badge>}
                          </div>
                          <Checkbox
                            checked={isLocked ? true : navVisibility[navKey] !== false}
                            onCheckedChange={(checked) => !isLocked && handleNavToggle(navKey, !!checked)}
                            disabled={isLocked}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : settingsSubTab === "users" ? (
              <UserManagement />
            ) : settingsSubTab === "checklist" ? (
              <ChecklistManagement />
            ) : settingsSubTab === "emails" ? (
              <ParsedEmailsTab />
            ) : settingsSubTab === "activity-log" ? (
              <ActivityLog />
            ) : settingsSubTab === "workflows" ? (
              <WorkflowManager />
            ) : (
              <SettingsPanel activeSubTab={settingsSubTab} />
            )}
            {currentUser?.team === "super_admin" && <TenantManagement />}
          </div>}

          {/* Tenants Tab (Super Admin only) */}
          {activeTab === "tenants" && currentUser?.team === "super_admin" && <TenantManagement />}

          </div>
        </div>
      </main>

      <CSVUploadDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} />
      <AddProjectDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSave={handleAddProject} />

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedCount={selectedProjects.size}
        onSave={handleBulkEdit}
      />

      {/* Bulk Assign Dialog */}
      {bulkAssignDialogOpen && (
        <AssignOwnerDialog
          open={bulkAssignDialogOpen}
          onOpenChange={setBulkAssignDialogOpen}
          projectIds={Array.from(selectedProjects)}
          onAssigned={() => setSelectedProjects(new Set())}
        />
      )}

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedProjects.size} project(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected projects and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk State Update */}
      <AlertDialog open={bulkStateDialogOpen} onOpenChange={setBulkStateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update state for {selectedProjects.size} project(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new project state to apply to all selected projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkStateValue} onValueChange={(v) => setBulkStateValue(v as ProjectState)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(projectStateLabels) as ProjectState[]).map(s => (
                  <SelectItem key={s} value={s}>{stateLabelsFromCtx[s] || projectStateLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStateUpdate}>Update All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
