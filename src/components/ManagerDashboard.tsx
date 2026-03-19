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
import { CSVUploadDialog } from "./CSVUploadDialog";
import { AddProjectDialog } from "./AddProjectDialog";
import { AssignOwnerDialog } from "./AssignOwnerDialog";
import { Project, calculateTimeByParty, calculateTimeFromChecklist, formatDuration, projectStateLabels, ProjectState, ProjectPhase } from "@/data/projectsData";
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
  Target,
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
  X,
} from "lucide-react";
import { exportProjectsToCSV } from "@/utils/exportProjects";
import { exportProjectChecklistCSV, exportTeamOwnerCSV } from "@/utils/reportExportCSV";
import { useCustomFields, useAllCustomFieldValues } from "@/hooks/useCustomFields";
import { ThemeToggle } from "./ThemeToggle";
import { toast } from "sonner";
import { fetchAiInsights } from "@/utils/aiInsights";
import { cn } from "@/lib/utils";

// Report components
import { ExecutiveDashboard } from "./reports/ExecutiveDashboard";
import { OperationalReports } from "./reports/OperationalReports";
import { MerchantResponsibility } from "./reports/MerchantResponsibility";
import { TacticalLists } from "./reports/TacticalLists";
import { ReportsBuilder } from "./reports/ReportsBuilder";
import { ReportScheduler } from "./reports/ReportScheduler";

// Sub-tab keys for reports and settings
const REPORTS_SUB_TABS = ["predefined", "builder", "pivot", "scheduler"];
const SETTINGS_SUB_TABS = ["general", "workflow", "fields", "custom-fields", "checklist-forms", "colours", "email"];
const PREDEFINED_REPORT_TYPES = ["executive", "operational", "merchant", "tactical", "project", "team"];

// All nav items that can be toggled
const ALL_NAV_ITEMS = ["dashboard", "projects", "listview", "kanban", "calendar", "reports", "checklist", "users", "settings", "emails"];

export const ManagerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { labels: appLabels, teamLabels, responsibilityLabels, phaseLabels, stateLabels: stateLabelsFromCtx, updateLabels } = useLabels();
  const { projects, isLoading, addProject, deleteProject, updateProject } = useProjects();
  const { fields: customFields } = useCustomFields();
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { valuesMap: customValuesMap } = useAllCustomFieldValues(projectIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [responsibilityFilter, setResponsibilityFilter] = useState<string>("all");
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
    { key: "merchantState", label: "Merchant State" },
    { key: "mintComment", label: "Mint Comment" },
    { key: "liveDate", label: "Live Date" },
    { key: "recentComments", label: "Recent Comments" },
    { key: "status", label: "Status" },
    { key: "arr", label: "ARR" },
    { key: "owner", label: "Owner" },
    { key: "salesSpoc", label: "Sales SPOC" },
    { key: "kickOffDate", label: "Start Date" },
    { key: "goLiveDate", label: "Go-Live Date" },
    { key: "integrationType", label: "Integration Type" },
    { key: "pgOnboarding", label: "PG Onboarding" },
    { key: "goLivePercent", label: "Go-Live %" },
  ];
  const [listViewColumns, setListViewColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("listview_columns");
      return saved ? JSON.parse(saved) : ["merchantName", "platform", "category", "merchantState", "mintComment", "liveDate", "recentComments", "status"];
    } catch { return ["merchantName", "platform", "category", "merchantState", "mintComment", "liveDate", "recentComments", "status"]; }
  });
  const [listViewPage, setListViewPage] = useState(1);
  const [listViewPageSize, setListViewPageSize] = useState(10);

  // Nav visibility from labels
  const getNavVisibility = (): Record<string, boolean> => {
    try {
      const saved = appLabels.nav_visibility;
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(ALL_NAV_ITEMS.map(k => [k, true]));
  };
  const navVisibility = getNavVisibility();

  // Draggable tab order
  const DEFAULT_TAB_ORDER = ["dashboard", "projects", "calendar", "reports", "checklist", "users", "settings", "kanban", "emails"];
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
  const TAB_CONFIG_KEYS = ["dashboard", "projects", "calendar", "reports", "checklist", "users", "settings", "kanban", "emails", "tenants"];

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
    if (teamFilter === "all") return allProfiles.filter(p => p.team !== "manager");
    return allProfiles.filter(p => p.team === teamFilter);
  }, [allProfiles, teamFilter]);

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter projects with new filters
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === "all" || p.currentOwnerTeam === teamFilter;
    const matchesOwner = ownerFilter === "all" || p.assignedOwner === ownerFilter;
    const matchesPhase = phaseFilter === "all" || getProjectPhaseLabel(p) === phaseFilter;
    const matchesState = stateFilter === "all" || p.projectState === stateFilter;
    const matchesPlatform = platformFilter === "all" || p.platform === platformFilter;
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesResponsibility = responsibilityFilter === "all" || p.currentResponsibility === responsibilityFilter;
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

  // Time distribution - use checklist-level aggregation
  let totalGokwikTime = 0;
  let totalMerchantTime = 0;
  displayProjects.forEach((p) => {
    const time = calculateTimeFromChecklist(p.checklist);
    totalGokwikTime += time.gokwik;
    totalMerchantTime += time.merchant;
  });

  // Pipeline stats for overview
  const totalArr = displayProjects.reduce((s, p) => s + p.arr, 0);
  const liveArr = displayProjects.filter(p => p.projectState === "live").reduce((s, p) => s + p.arr, 0);
  const blockedProjects = displayProjects.filter(p => p.projectState === "blocked").length;
  const onHoldProjects = displayProjects.filter(p => p.projectState === "on_hold").length;

  const handleAddProject = (project: Project) => {
    addProject(project);
    toast.success(`Added ${project.merchantName}`);
  };

  const filteredProjectIds = filteredProjects.map(p => p.id);
  const allFilteredSelected = filteredProjectIds.length > 0 && filteredProjectIds.every(id => selectedProjects.has(id));

  const clearFilters = () => {
    setTeamFilter("all");
    setOwnerFilter("all");
    setPhaseFilter("all");
    setStateFilter("all");
    setPlatformFilter("all");
    setCategoryFilter("all");
    setResponsibilityFilter("all");
    setArrMin("");
    setArrMax("");
    setKickOffFrom("");
    setKickOffTo("");
    setGoLiveFrom("");
    setGoLiveTo("");
  };

  const hasActiveFilters = teamFilter !== "all" || ownerFilter !== "all" || phaseFilter !== "all" || stateFilter !== "all" || platformFilter !== "all" || categoryFilter !== "all" || responsibilityFilter !== "all" || arrMin || arrMax || kickOffFrom || kickOffTo || goLiveFrom || goLiveTo;

  // Tab config for sidebar
  const TAB_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
    dashboard: { icon: <PieChart className="h-4 w-4" />, label: "Dashboard" },
    projects: { icon: <FolderKanban className="h-4 w-4" />, label: "Projects" },
    calendar: { icon: <CalendarDays className="h-4 w-4" />, label: "Calendar" },
    reports: { icon: <TrendingUp className="h-4 w-4" />, label: "Reports" },
    checklist: { icon: <ListChecks className="h-4 w-4" />, label: "Checklist" },
    users: { icon: <Users className="h-4 w-4" />, label: "Users" },
    settings: { icon: <Settings className="h-4 w-4" />, label: "Settings" },
    kanban: { icon: <FolderKanban className="h-4 w-4" />, label: "Kanban" },
    emails: { icon: <Mail className="h-4 w-4" />, label: "Emails" },
    tenants: { icon: <Building2 className="h-4 w-4" />, label: "Tenants" },
  };

  const SETTINGS_SUB_CONFIG: Record<string, { label: string }> = {
    general: { label: "General" },
    workflow: { label: "Workflow" },
    fields: { label: "Field Labels" },
    "custom-fields": { label: "Custom Fields" },
    "checklist-forms": { label: "Checklist Forms" },
    colours: { label: "Colours" },
    email: { label: "Email" },
    navigation: { label: "Navigation" },
  };

  const REPORTS_SUB_CONFIG: Record<string, { label: string; icon?: string }> = {
    predefined: { label: "Pre Defined" },
    builder: { label: "Report Builder" },
    pivot: { label: "Pivot Table", icon: "Σ" },
    scheduler: { label: "📅 Scheduler" },
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

  const sidebarTabs = [...tabOrder, ...(currentUser?.team === "super_admin" && !tabOrder.includes("tenants") ? ["tenants"] : [])]
    .filter(tab => tab !== "tenants" || currentUser?.team === "super_admin")
    .filter(tab => TAB_CONFIG[tab])
    .filter(tab => navVisibility[tab] !== false || tab === "tenants" || tab === "settings");

  const activeTabLabel = activeTab === "settings" 
    ? `Settings — ${SETTINGS_SUB_CONFIG[settingsSubTab]?.label || "General"}`
    : activeTab === "reports"
    ? `Reports — ${REPORTS_SUB_CONFIG[reportSubTab]?.label || "Pre Defined"}`
    : TAB_CONFIG[activeTab]?.label || "Dashboard";

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
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group",
            isActive && !isReports && !isSettings
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : isParentActive
              ? "bg-muted text-foreground font-semibold"
              : "hover:bg-muted/60 text-foreground/60 hover:text-foreground",
            draggedTab === tab ? "opacity-50" : ""
          )}
        >
          <span className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors",
            isActive && !isReports && !isSettings
              ? "bg-primary-foreground/20 text-primary-foreground"
              : isParentActive
              ? "bg-primary/10 text-primary"
              : "bg-muted/80 text-foreground/50 group-hover:text-foreground"
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
                    : "text-foreground/60 hover:text-foreground hover:bg-muted/60"
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
            {Object.entries(SETTINGS_SUB_CONFIG).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => { setActiveTab("settings"); setSettingsSubTab(key); }}
                className={cn(
                  "w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  settingsSubTab === key && activeTab === "settings"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground/60 hover:text-foreground hover:bg-muted/60"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex">
      {/* Left Sidebar — dark themed */}
      <aside className="w-72 bg-card border-r border-border flex flex-col shrink-0">
        {/* Logo & Title */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {appLabels.org_logo_url ? (
              <img src={appLabels.org_logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-contain shadow-lg ring-2 ring-primary/20" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg ring-2 ring-primary/30">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-base text-foreground">{appLabels.app_title}</h1>
              <p className="text-xs text-muted-foreground">{appLabels.app_subtitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 px-4">
            Navigation
          </p>
          <div className="space-y-1">
            {sidebarTabs.map((tab) => renderNavItem(tab))}
          </div>
        </nav>

        {/* User card at bottom */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">Manager</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b bg-background/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{activeTabLabel}</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeTab === "projects" ? `${filteredProjects.length} project${filteredProjects.length !== 1 ? "s" : ""} found` : appLabels.app_subtitle}
            </span>
          </div>

          <div className="flex items-center gap-3">
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
            </div>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-8">

          {/* ========= OVERVIEW TAB ========= */}
          {activeTab === "dashboard" && <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const kpiColor = (key: string, fallback: string) => appLabels[key] || fallback;
                const totalC = kpiColor("color_kpi_total", "#3b82f6");
                const pendingC = kpiColor("color_kpi_pending", "#f59e0b");
                const activeC = kpiColor("color_kpi_active", "#3b82f6");
                const liveC = kpiColor("color_kpi_live", "#10b981");
                const kpiCards = [
                  { label: "Total", value: totalProjects, color: totalC, icon: FolderKanban, sub: `Pipeline ARR: ${totalArr.toFixed(2)} Cr` },
                  { label: "Pending", value: pendingProjects, color: pendingC, icon: AlertCircle, sub: "Awaiting acceptance" },
                  { label: "Active", value: activeProjects, color: activeC, icon: Rocket, sub: `${blockedProjects} blocked, ${onHoldProjects} on hold` },
                  { label: "Live", value: completedProjects, color: liveC, icon: CheckCircle2, sub: `Live ARR: ${liveArr.toFixed(2)} Cr` },
                ];
                return kpiCards.map((kpi) => (
                  <Card key={kpi.label} className="hover:shadow-lg transition-shadow" style={{ background: `linear-gradient(135deg, ${kpi.color}15 0%, ${kpi.color}08 100%)`, borderColor: `${kpi.color}33` }}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">{kpi.label}</p>
                          <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                          <kpi.icon className="h-6 w-6" style={{ color: kpi.color }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{kpi.sub}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>

            {/* Team Performance & Time Distribution */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Team Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <div className="space-y-6">
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
                      return (
                        <div key={team.team} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-lg ${teamColors[team.team]} flex items-center justify-center text-white font-bold`}>
                                {team.teamLabel.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold">{team.teamLabel}</p>
                                <p className="text-xs text-muted-foreground">{totalCount} projects</p>
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const tpTotal = appLabels.color_team_perf_total || "#6b7280";
                            const tpPending = appLabels.color_team_perf_pending || "#f59e0b";
                            const tpActive = appLabels.color_team_perf_active || "#3b82f6";
                            const tpCompleted = appLabels.color_team_perf_completed || "#10b981";
                            const miniCards = [
                              { label: "Total", value: totalCount, color: tpTotal },
                              { label: "Pending", value: pendingCount, color: tpPending },
                              { label: "Active", value: activeCount, color: tpActive },
                              { label: "Completed", value: completedCount, color: tpCompleted },
                            ];
                            return (
                              <div className="grid grid-cols-4 gap-2 text-center">
                                {miniCards.map(mc => (
                                  <div key={mc.label} className="rounded-lg p-2" style={{ backgroundColor: `${mc.color}15` }}>
                                    <p className="text-lg font-bold" style={{ color: mc.color }}>{mc.value}</p>
                                    <p className="text-[10px] text-muted-foreground">{mc.label}</p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {team.pendingCount > 0 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200">
                              {team.pendingCount} pending acceptance
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    Time Distribution
                  </CardTitle>
                  <CardDescription>Total time tracked across all projects (from checklist items)</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {(() => {
                      const intColor = appLabels.color_time_internal || "#3b82f6";
                      const extColor = appLabels.color_time_external || "#f59e0b";
                      return (
                        <div className="grid grid-cols-2 gap-6">
                          <div className="rounded-xl p-6 text-center" style={{ background: `linear-gradient(135deg, ${intColor}18 0%, ${intColor}08 100%)` }}>
                            <Building2 className="h-8 w-8 mx-auto mb-3" style={{ color: intColor }} />
                            <p className="text-3xl font-bold" style={{ color: intColor }}>{formatDuration(totalGokwikTime)}</p>
                            <p className="text-sm text-muted-foreground mt-1">{responsibilityLabels.gokwik} Time</p>
                          </div>
                          <div className="rounded-xl p-6 text-center" style={{ background: `linear-gradient(135deg, ${extColor}18 0%, ${extColor}08 100%)` }}>
                            <Users className="h-8 w-8 mx-auto mb-3" style={{ color: extColor }} />
                            <p className="text-3xl font-bold" style={{ color: extColor }}>{formatDuration(totalMerchantTime)}</p>
                            <p className="text-sm text-muted-foreground mt-1">{responsibilityLabels.merchant} Time</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Distribution</span>
                        <span className="font-medium">
                          {Math.round((totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100)}% / {Math.round((totalMerchantTime / (totalGokwikTime + totalMerchantTime || 1)) * 100)}%
                        </span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        <div className="transition-all" style={{ width: `${(totalGokwikTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%`, backgroundColor: appLabels.color_time_internal || "#3b82f6" }} />
                        <div className="transition-all" style={{ width: `${(totalMerchantTime / (totalGokwikTime + totalMerchantTime || 1)) * 100}%`, backgroundColor: appLabels.color_time_external || "#f59e0b" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Phase Distribution & State Distribution */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                   <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Project Phase Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
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
                          <div key={label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate max-w-[70%]" title={label}>{label}</span>
                              <span className="font-bold whitespace-nowrap">{count} ({pct}%)</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl border-border/50">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    State Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {(Object.keys(projectStateLabels) as ProjectState[]).map(state => {
                      const count = displayProjects.filter(p => p.projectState === state).length;
                      const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                      return (
                        <div key={state} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stateLabelsFromCtx[state] || projectStateLabels[state]}</span>
                            <span className="font-bold">{count} ({pct}%)</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>}

          {/* ========= PROJECTS TAB ========= */}
          {activeTab === "projects" && <div className="space-y-6">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 relative">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      All Projects
                    </CardTitle>
                    {/* Sort Dropdown - left side */}
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <ArrowUpDown className="h-4 w-4" />
                          Sort
                          {sortField !== "none" && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">1</Badge>}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="absolute z-20 mt-2 left-0 top-full w-[320px] bg-card border rounded-lg shadow-xl p-4 space-y-3">
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
                      </CollapsibleContent>
                    </Collapsible>
                    {/* Filters - left side */}
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Search className="h-4 w-4" />
                          Filters
                          {hasActiveFilters && <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">{[teamFilter !== "all", ownerFilter !== "all", phaseFilter !== "all", stateFilter !== "all", kickOffFrom, kickOffTo, goLiveFrom, goLiveTo].filter(Boolean).length}</Badge>}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="absolute z-20 mt-2 left-0 top-full w-[600px] bg-card border rounded-lg shadow-xl p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">Filters</p>
                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">Clear All</Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Team</label>
                            <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setOwnerFilter("all"); }}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All Teams" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Teams</SelectItem>
                                <SelectItem value="mint">{teamLabels.mint}</SelectItem>
                                <SelectItem value="integration">{teamLabels.integration}</SelectItem>
                                <SelectItem value="ms">{teamLabels.ms}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Owner</label>
                            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All Owners" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Owners</SelectItem>
                                {filteredOwners.map((owner) => (
                                  <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Phase</label>
                            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All Phases" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Phases</SelectItem>
                                {uniquePhaseLabels.map(label => (
                                  <SelectItem key={label} value={label}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">State</label>
                            <Select value={stateFilter} onValueChange={setStateFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All States" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All States</SelectItem>
                                {(Object.keys(projectStateLabels) as ProjectState[]).map(s => (
                                  <SelectItem key={s} value={s}>{stateLabelsFromCtx[s] || projectStateLabels[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Platform</label>
                            <Select value={platformFilter} onValueChange={setPlatformFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All Platforms" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Platforms</SelectItem>
                                {uniquePlatforms.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Category</label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All Categories" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {uniqueCategories.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Responsibility</label>
                            <Select value={responsibilityFilter} onValueChange={setResponsibilityFilter}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="gokwik">{responsibilityLabels.gokwik}</SelectItem>
                                <SelectItem value="merchant">{responsibilityLabels.merchant}</SelectItem>
                                <SelectItem value="neutral">Neutral</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                  <div className="p-6 space-y-4">
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
                    {sortedProjects.length > 0 && (
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <Checkbox checked={allFilteredSelected} onCheckedChange={() => toggleSelectAll(filteredProjectIds)} />
                        <span className="text-sm text-muted-foreground">Select all ({sortedProjects.length})</span>
                      </div>
                    )}
                    {sortedProjects.length === 0 ? (
                      <div className="text-center py-20">
                        <FolderKanban className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Projects Found</h3>
                        <p className="text-muted-foreground">Try adjusting your filters or add a new project.</p>
                      </div>
                    ) : (
                      sortedProjects.map((project) => (
                        <div key={project.id} className="flex items-start gap-3">
                          <div className="pt-4">
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
          </div>}

          {/* ========= CALENDAR TAB ========= */}
          {activeTab === "calendar" && <div className="space-y-6">
            <ProjectCalendar />
          </div>}

          {/* ========= REPORTS TAB ========= */}
          {activeTab === "reports" && <div className="space-y-6">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Reports
                  </CardTitle>
                </div>
              </CardHeader>
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
                        {/* AI Insights + Download */}
                        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                AI Project & Checklist Insights
                              </CardTitle>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => exportProjectChecklistCSV(displayProjects, { teamLabels, responsibilityLabels, phaseLabels, stateLabels: stateLabelsFromCtx, getLabel: (k: string) => k })} className="gap-2">
                                  <Download className="h-3 w-3" />
                                  Export CSV
                                </Button>
                                <Button size="sm" variant="outline" onClick={fetchProjectAiInsight} disabled={projectAiLoading} className="gap-2">
                                  {projectAiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  {projectAiInsight ? "Refresh" : "Generate"}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {projectAiInsight && (
                            <CardContent className="pt-0">
                              <div className="text-sm space-y-1 whitespace-pre-line">{projectAiInsight}</div>
                            </CardContent>
                          )}
                        </Card>
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
                        {/* AI Insights + Download */}
                        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                AI Team & Owner Insights
                              </CardTitle>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => exportTeamOwnerCSV(teamOwnerReport)} className="gap-2">
                                  <Download className="h-3 w-3" />
                                  Export CSV
                                </Button>
                                <Button size="sm" variant="outline" onClick={fetchTeamAiInsight} disabled={teamAiLoading} className="gap-2">
                                  {teamAiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  {teamAiInsight ? "Refresh" : "Generate"}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {teamAiInsight && (
                            <CardContent className="pt-0">
                              <div className="text-sm space-y-1 whitespace-pre-line">{teamAiInsight}</div>
                            </CardContent>
                          )}
                        </Card>
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

                  {/* Sub-tab: Pivot Table */}
                  {reportSubTab === "pivot" && (
                    <ReportsBuilder projects={displayProjects} customFields={customFields} customValuesMap={customValuesMap} initialPivot />
                  )}

                  {/* Sub-tab: Scheduler */}
                  {reportSubTab === "scheduler" && (
                    <ReportScheduler />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>}

          {/* Checklist Tab */}
          {activeTab === "checklist" && <ChecklistManagement />}

          {/* Users Tab */}
          {activeTab === "users" && <UserManagement />}

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
            ) : (
              <SettingsPanel activeSubTab={settingsSubTab} />
            )}
            {currentUser?.team === "super_admin" && <TenantManagement />}
          </div>}

          {/* Kanban Tab */}
          {activeTab === "kanban" && <KanbanBoard />}

          {/* Emails Tab */}
          {activeTab === "emails" && <div className="space-y-6">
            <ParsedEmailsTab />
          </div>}

          {/* Tenants Tab (Super Admin only) */}
          {activeTab === "tenants" && currentUser?.team === "super_admin" && <TenantManagement />}

          </div>
        </ScrollArea>
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
