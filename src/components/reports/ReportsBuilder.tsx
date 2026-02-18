import { useState, useEffect, useMemo } from "react";
import { Project, projectStateLabels, formatDuration, calculateTimeFromChecklist } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Trash2, Play, Plus, Clock, Calendar, FileText, X, ChevronRight, ChevronDown, Sigma } from "lucide-react";

// All available columns for report builder
const AVAILABLE_COLUMNS: { key: string; label: string; group: string }[] = [
  { key: "merchantName", label: "Merchant Name", group: "Basic" },
  { key: "mid", label: "MID", group: "Basic" },
  { key: "platform", label: "Platform", group: "Basic" },
  { key: "category", label: "Category", group: "Basic" },
  { key: "arr", label: "ARR", group: "Financial" },
  { key: "txnsPerDay", label: "Txns/Day", group: "Financial" },
  { key: "aov", label: "AOV", group: "Financial" },
  { key: "projectState", label: "Project State", group: "Status" },
  { key: "currentPhase", label: "Current Phase", group: "Status" },
  { key: "currentOwnerTeam", label: "Current Team", group: "Status" },
  { key: "assignedOwnerName", label: "Assigned Owner", group: "Status" },
  { key: "currentResponsibility", label: "Responsibility", group: "Status" },
  { key: "goLivePercent", label: "Go Live %", group: "Status" },
  { key: "pendingAcceptance", label: "Pending Acceptance", group: "Status" },
  { key: "kickOffDate", label: "Kick-Off Date", group: "Dates" },
  { key: "expectedGoLiveDate", label: "Expected Go-Live", group: "Dates" },
  { key: "goLiveDate", label: "Go-Live Date", group: "Dates" },
  { key: "salesSpoc", label: "Sales SPOC", group: "Details" },
  { key: "integrationType", label: "Integration Type", group: "Details" },
  { key: "pgOnboarding", label: "PG Onboarding", group: "Details" },
  { key: "brandUrl", label: "Brand URL", group: "Links" },
  { key: "jiraLink", label: "JIRA Link", group: "Links" },
  { key: "brdLink", label: "BRD Link", group: "Links" },
  { key: "mintNotes", label: "MINT Notes", group: "Notes" },
  { key: "projectNotes", label: "Project Notes", group: "Notes" },
  { key: "currentPhaseComment", label: "Phase Comment", group: "Notes" },
  { key: "checklistProgress", label: "Checklist Progress", group: "Metrics" },
  { key: "gokwikTime", label: "GoKwik Time", group: "Metrics" },
  { key: "merchantTime", label: "Merchant Time", group: "Metrics" },
  { key: "transferCount", label: "Transfer Count", group: "Metrics" },
];

const GROUPABLE_COLUMNS = ["projectState", "currentPhase", "currentOwnerTeam", "platform", "category", "assignedOwnerName", "currentResponsibility", "integrationType", "pgOnboarding", "salesSpoc"];
const NUMERIC_COLUMNS = ["arr", "txnsPerDay", "aov", "goLivePercent", "transferCount"];

interface SavedReport {
  id: string;
  name: string;
  columns: string[];
  schedule: string;
  recipients: string[];
}

function getCellValue(project: Project, key: string, labels: any): string {
  switch (key) {
    case "merchantName": return project.merchantName;
    case "mid": return project.mid;
    case "platform": return project.platform;
    case "category": return project.category;
    case "arr": return project.arr.toFixed(2);
    case "txnsPerDay": return String(project.txnsPerDay);
    case "aov": return String(project.aov);
    case "projectState": return labels.stateLabels[project.projectState] || project.projectState;
    case "currentPhase": return labels.phaseLabels[project.currentPhase] || project.currentPhase;
    case "currentOwnerTeam": return labels.teamLabels[project.currentOwnerTeam] || project.currentOwnerTeam;
    case "assignedOwnerName": return project.assignedOwnerName || "Unassigned";
    case "currentResponsibility": return labels.responsibilityLabels[project.currentResponsibility] || project.currentResponsibility;
    case "goLivePercent": return `${project.goLivePercent}%`;
    case "pendingAcceptance": return project.pendingAcceptance ? "Yes" : "No";
    case "kickOffDate": return project.dates.kickOffDate;
    case "expectedGoLiveDate": return project.dates.expectedGoLiveDate || "";
    case "goLiveDate": return project.dates.goLiveDate || "";
    case "salesSpoc": return project.salesSpoc;
    case "integrationType": return project.integrationType;
    case "pgOnboarding": return project.pgOnboarding;
    case "brandUrl": return project.links.brandUrl;
    case "jiraLink": return project.links.jiraLink || "";
    case "brdLink": return project.links.brdLink || "";
    case "mintNotes": return project.notes.mintNotes || "";
    case "projectNotes": return project.notes.projectNotes || "";
    case "currentPhaseComment": return project.notes.currentPhaseComment || "";
    case "checklistProgress": {
      const done = project.checklist.filter(c => c.completed).length;
      return `${done}/${project.checklist.length}`;
    }
    case "gokwikTime": return formatDuration(calculateTimeFromChecklist(project.checklist).gokwik);
    case "merchantTime": return formatDuration(calculateTimeFromChecklist(project.checklist).merchant);
    case "transferCount": return String(project.transferHistory.length);
    default: return "";
  }
}

function getNumericValue(project: Project, key: string): number {
  switch (key) {
    case "arr": return project.arr;
    case "txnsPerDay": return project.txnsPerDay;
    case "aov": return project.aov;
    case "goLivePercent": return project.goLivePercent;
    case "transferCount": return project.transferHistory.length;
    default: return 0;
  }
}

interface PivotGroup {
  key: string;
  label: string;
  projects: Project[];
  aggregates: Record<string, { sum: number; avg: number; count: number }>;
}

export const ReportsBuilder = ({ projects }: { projects: Project[] }) => {
  const { teamLabels, responsibilityLabels, phaseLabels, stateLabels } = useLabels();
  const { currentUser } = useAuth();
  const labels = { teamLabels, responsibilityLabels, phaseLabels, stateLabels };

  const [selectedColumns, setSelectedColumns] = useState<string[]>(["merchantName", "projectState", "arr", "currentPhase", "goLivePercent"]);
  const [groupByColumn, setGroupByColumn] = useState<string>("none");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [schedule, setSchedule] = useState<string>("none");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("saved_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        setSavedReports(data.map((r: any) => ({
          id: r.id, name: r.name, columns: r.columns || [], schedule: r.schedule || "none", recipients: r.recipients || [],
        })));
      }
    };
    fetchReports();
  }, []);

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const columnGroups = useMemo(() => {
    const groups: Record<string, typeof AVAILABLE_COLUMNS> = {};
    AVAILABLE_COLUMNS.forEach(col => {
      if (!groups[col.group]) groups[col.group] = [];
      groups[col.group].push(col);
    });
    return groups;
  }, []);

  const pivotGroups = useMemo<PivotGroup[]>(() => {
    if (groupByColumn === "none") return [];
    const groupMap = new Map<string, Project[]>();
    projects.forEach(p => {
      const val = getCellValue(p, groupByColumn, labels);
      const existing = groupMap.get(val) || [];
      existing.push(p);
      groupMap.set(val, existing);
    });
    return Array.from(groupMap.entries()).map(([key, groupProjects]) => {
      const aggregates: Record<string, { sum: number; avg: number; count: number }> = {};
      NUMERIC_COLUMNS.forEach(col => {
        if (!selectedColumns.includes(col)) return;
        const values = groupProjects.map(p => getNumericValue(p, col));
        const sum = values.reduce((a, b) => a + b, 0);
        aggregates[col] = { sum, avg: values.length > 0 ? sum / values.length : 0, count: values.length };
      });
      return { key, label: key || "—", projects: groupProjects, aggregates };
    });
  }, [groupByColumn, projects, selectedColumns, labels]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && email.includes("@") && !recipients.includes(email)) {
      setRecipients(prev => [...prev, email]);
      setRecipientInput("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(e => e !== email));
  };

  const handleSaveReport = async () => {
    if (!reportName.trim()) { toast.error("Please enter a report name"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("saved_reports").insert({
        name: reportName.trim(), columns: selectedColumns, schedule, recipients,
        tenant_id: currentUser?.tenantId, created_by: currentUser?.id,
      }).select().single();
      if (error) throw error;
      setSavedReports(prev => [{ id: data.id, name: data.name, columns: data.columns || [], schedule: data.schedule || "none", recipients: data.recipients || [] }, ...prev]);
      toast.success(`Report "${reportName}" saved`);
      setSaveDialogOpen(false); setReportName(""); setSchedule("none"); setRecipients([]);
    } catch (err: any) { toast.error(err.message || "Failed to save report"); }
    finally { setLoading(false); }
  };

  const handleDeleteReport = async (id: string) => {
    const { error } = await supabase.from("saved_reports").delete().eq("id", id);
    if (!error) { setSavedReports(prev => prev.filter(r => r.id !== id)); toast.success("Report deleted"); }
  };

  const loadReport = (report: SavedReport) => { setSelectedColumns(report.columns); toast.info(`Loaded "${report.name}"`); };

  const exportReportCSV = () => {
    const headers = selectedColumns.map(k => AVAILABLE_COLUMNS.find(c => c.key === k)?.label || k);
    const rows = projects.map(p => selectedColumns.map(k => {
      const val = getCellValue(p, k, labels);
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `custom-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  const formatAgg = (key: string, val: number) => {
    if (key === "arr") return val.toFixed(2);
    if (key === "goLivePercent") return `${val.toFixed(0)}%`;
    return val.toFixed(1);
  };

  const renderPivotTable = () => {
    const displayCols = selectedColumns.filter(k => k !== groupByColumn);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-8"></TableHead>
            {displayCols.map(key => {
              const col = AVAILABLE_COLUMNS.find(c => c.key === key);
              return <TableHead key={key} className="text-xs whitespace-nowrap">{col?.label || key}</TableHead>;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pivotGroups.map(group => {
            const isExpanded = expandedGroups.has(group.key);
            const groupLabel = AVAILABLE_COLUMNS.find(c => c.key === groupByColumn)?.label || groupByColumn;
            return (
              <> 
                <TableRow
                  key={`group-${group.key}`}
                  className="bg-muted/60 hover:bg-muted/80 cursor-pointer font-medium"
                  onClick={() => toggleGroup(group.key)}
                >
                  <TableCell className="py-2 px-2">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell colSpan={1} className="text-xs font-semibold py-2">
                    <span className="text-muted-foreground mr-1">{groupLabel}:</span>
                    {group.label}
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{group.projects.length}</Badge>
                  </TableCell>
                  {displayCols.slice(1).map(col => {
                    const agg = group.aggregates[col];
                    if (agg) {
                      return (
                        <TableCell key={col} className="text-xs py-2">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Sigma className="h-3 w-3" />
                            <span className="font-mono font-semibold text-foreground">{formatAgg(col, agg.sum)}</span>
                            <span className="text-[10px]">avg {formatAgg(col, agg.avg)}</span>
                          </div>
                        </TableCell>
                      );
                    }
                    return <TableCell key={col} className="text-xs py-2 text-muted-foreground">—</TableCell>;
                  })}
                </TableRow>
                {isExpanded && group.projects.map(project => (
                  <TableRow key={project.id} className="bg-background">
                    <TableCell></TableCell>
                    {displayCols.map(key => (
                      <TableCell key={key} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                        {getCellValue(project, key, labels)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderFlatTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          {selectedColumns.map(key => {
            const col = AVAILABLE_COLUMNS.find(c => c.key === key);
            return <TableHead key={key} className="text-xs whitespace-nowrap">{col?.label || key}</TableHead>;
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map(project => (
          <TableRow key={project.id}>
            {selectedColumns.map(key => (
              <TableCell key={key} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                {getCellValue(project, key, labels)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      {savedReports.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Saved Reports</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="flex flex-wrap gap-2">
              {savedReports.map(report => (
                <div key={report.id} className="flex items-center gap-1 border rounded-lg px-3 py-1.5 bg-muted/30">
                  <button onClick={() => loadReport(report)} className="text-sm font-medium hover:text-primary transition-colors">{report.name}</button>
                  {report.schedule !== "none" && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {report.schedule === "daily" ? <Clock className="h-3 w-3 mr-0.5 inline" /> : <Calendar className="h-3 w-3 mr-0.5 inline" />}
                      {report.schedule}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleDeleteReport(report.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Select Columns ({selectedColumns.length} selected)</CardTitle>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Group By:</Label>
                <Select value={groupByColumn} onValueChange={setGroupByColumn}>
                  <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    {GROUPABLE_COLUMNS.filter(k => selectedColumns.includes(k)).map(k => {
                      const col = AVAILABLE_COLUMNS.find(c => c.key === k);
                      return <SelectItem key={k} value={k}>{col?.label || k}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportReportCSV}>
                <Play className="h-3 w-3" />Export CSV
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setSaveDialogOpen(true)}>
                <Save className="h-3 w-3" />Save & Schedule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1">
            {Object.entries(columnGroups).map(([group, cols]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group}</p>
                {cols.map(col => (
                  <label key={col.key} className="flex items-center gap-1.5 py-0.5 cursor-pointer text-xs hover:text-primary transition-colors">
                    <Checkbox checked={selectedColumns.includes(col.key)} onCheckedChange={() => toggleColumn(col.key)} className="h-3.5 w-3.5" />
                    {col.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Report Preview ({projects.length} projects)
              {groupByColumn !== "none" && (
                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                  Grouped by {AVAILABLE_COLUMNS.find(c => c.key === groupByColumn)?.label}
                </Badge>
              )}
            </CardTitle>
            {groupByColumn !== "none" && (
              <Button variant="ghost" size="sm" className="h-6 text-[11px]"
                onClick={() => {
                  if (expandedGroups.size === pivotGroups.length) setExpandedGroups(new Set());
                  else setExpandedGroups(new Set(pivotGroups.map(g => g.key)));
                }}
              >
                {expandedGroups.size === pivotGroups.length ? "Collapse All" : "Expand All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {groupByColumn !== "none" ? renderPivotTable() : renderFlatTable()}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Save & Schedule Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Report Name</Label>
              <Input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="e.g. Weekly ARR Summary" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Schedule</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Schedule</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {schedule !== "none" && (
              <div>
                <Label className="text-sm">Email Recipients</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={recipientInput} onChange={e => setRecipientInput(e.target.value)} placeholder="email@example.com"
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())} />
                  <Button size="sm" variant="outline" onClick={addRecipient} className="shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {recipients.map(email => (
                      <Badge key={email} variant="secondary" className="text-xs gap-1 pr-1">
                        {email}
                        <button onClick={() => removeRecipient(email)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveReport} disabled={loading}>{loading ? "Saving..." : "Save Report"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
