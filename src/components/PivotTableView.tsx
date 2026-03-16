import { useState, useMemo } from "react";
import { Project, formatDuration, calculateTimeFromChecklist } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import { CustomField } from "@/hooks/useCustomFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sigma } from "lucide-react";

const AVAILABLE_COLUMNS: { key: string; label: string }[] = [
  { key: "merchantName", label: "Merchant Name" },
  { key: "mid", label: "MID" },
  { key: "platform", label: "Platform" },
  { key: "category", label: "Category" },
  { key: "arr", label: "ARR" },
  { key: "txnsPerDay", label: "Txns/Day" },
  { key: "aov", label: "AOV" },
  { key: "projectState", label: "Project State" },
  { key: "currentPhase", label: "Current Phase" },
  { key: "currentOwnerTeam", label: "Current Team" },
  { key: "assignedOwnerName", label: "Assigned Owner" },
  { key: "currentResponsibility", label: "Responsibility" },
  { key: "goLivePercent", label: "Go Live %" },
  { key: "salesSpoc", label: "Sales SPOC" },
  { key: "integrationType", label: "Integration Type" },
  { key: "pgOnboarding", label: "PG Onboarding" },
];

const BASE_GROUPABLE = ["projectState", "currentPhase", "currentOwnerTeam", "platform", "category", "assignedOwnerName", "currentResponsibility", "integrationType", "pgOnboarding", "salesSpoc"];
const NUMERIC_COLUMNS = ["arr", "txnsPerDay", "aov", "goLivePercent"];

type AggType = "sum" | "avg" | "count" | "min" | "max";

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
    case "salesSpoc": return project.salesSpoc;
    case "integrationType": return project.integrationType;
    case "pgOnboarding": return project.pgOnboarding;
    default: return "";
  }
}

function getNumericValue(project: Project, key: string): number {
  switch (key) {
    case "arr": return project.arr;
    case "txnsPerDay": return project.txnsPerDay;
    case "aov": return project.aov;
    case "goLivePercent": return project.goLivePercent;
    default: return 0;
  }
}

function computeAgg(values: number[], type: AggType): number {
  if (values.length === 0) return 0;
  switch (type) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
  }
}

function formatAggVal(key: string, val: number, aggType: AggType): string {
  if (aggType === "count") return String(Math.round(val));
  if (key === "arr") return val.toFixed(2);
  if (key === "goLivePercent") return `${val.toFixed(0)}%`;
  return val.toFixed(1);
}

export const PivotTableView = ({ projects, customFields = [], customValuesMap = {} }: { projects: Project[]; customFields?: CustomField[]; customValuesMap?: Record<string, Record<string, string>> }) => {
  const { teamLabels, responsibilityLabels, phaseLabels, stateLabels } = useLabels();
  const labels = { teamLabels, responsibilityLabels, phaseLabels, stateLabels, customValuesMap };

  const [pivotRowField, setPivotRowField] = useState<string>("none");
  const [pivotColField, setPivotColField] = useState<string>("none");
  const [pivotValueField, setPivotValueField] = useState<string>("arr");
  const [pivotAggType, setPivotAggType] = useState<AggType>("sum");

  const allColumns = useMemo(() => {
    const customCols = customFields.map(f => ({ key: `custom_field_${f.id}`, label: f.field_label }));
    return [...AVAILABLE_COLUMNS, ...customCols];
  }, [customFields]);

  const groupableColumns = useMemo(() => {
    const custom = customFields.map(f => `custom_field_${f.id}`);
    return [...BASE_GROUPABLE, ...custom];
  }, [customFields]);

  const excelPivot = useMemo(() => {
    if (pivotRowField === "none") return null;
    const rowValues = new Set<string>();
    const colValues = new Set<string>();
    projects.forEach(p => {
      rowValues.add(getCellValue(p, pivotRowField, labels));
      if (pivotColField !== "none") colValues.add(getCellValue(p, pivotColField, labels));
    });
    const sortedRows = Array.from(rowValues).sort();
    const sortedCols = pivotColField !== "none" ? Array.from(colValues).sort() : ["Total"];
    const grid: Record<string, Record<string, number[]>> = {};
    sortedRows.forEach(r => { grid[r] = {}; sortedCols.forEach(c => { grid[r][c] = []; }); });
    projects.forEach(p => {
      const rowVal = getCellValue(p, pivotRowField, labels);
      const colVal = pivotColField !== "none" ? getCellValue(p, pivotColField, labels) : "Total";
      const numVal = getNumericValue(p, pivotValueField);
      if (grid[rowVal]?.[colVal]) grid[rowVal][colVal].push(numVal);
    });
    const result: Record<string, Record<string, number>> = {};
    const colTotals: Record<string, number[]> = {};
    sortedCols.forEach(c => { colTotals[c] = []; });
    sortedRows.forEach(r => {
      result[r] = {};
      sortedCols.forEach(c => {
        result[r][c] = computeAgg(grid[r][c], pivotAggType);
        colTotals[c].push(...grid[r][c]);
      });
    });
    const grandTotals: Record<string, number> = {};
    sortedCols.forEach(c => { grandTotals[c] = computeAgg(colTotals[c], pivotAggType); });
    return { rows: sortedRows, cols: sortedCols, data: result, grandTotals };
  }, [pivotRowField, pivotColField, pivotValueField, pivotAggType, projects, labels]);

  const formatPivotVal = (val: number) => formatAggVal(pivotValueField, val, pivotAggType);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sigma className="h-4 w-4" />Pivot Table
          </CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Rows:</Label>
              <Select value={pivotRowField} onValueChange={setPivotRowField}>
                <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {groupableColumns.map(k => {
                    const col = allColumns.find(c => c.key === k);
                    return <SelectItem key={k} value={k}>{col?.label || k}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Columns:</Label>
              <Select value={pivotColField} onValueChange={setPivotColField}>
                <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {groupableColumns.filter(k => k !== pivotRowField).map(k => {
                    const col = allColumns.find(c => c.key === k);
                    return <SelectItem key={k} value={k}>{col?.label || k}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Values:</Label>
              <Select value={pivotValueField} onValueChange={setPivotValueField}>
                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NUMERIC_COLUMNS.map(k => {
                    const col = allColumns.find(c => c.key === k);
                    return <SelectItem key={k} value={k}>{col?.label || k}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Agg:</Label>
              <Select value={pivotAggType} onValueChange={(v) => setPivotAggType(v as AggType)}>
                <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[60vh]">
          {!excelPivot ? (
            <p className="text-sm text-muted-foreground p-4">Select a Row field to create a pivot table.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold whitespace-nowrap sticky left-0 bg-muted/50 z-10">
                    {allColumns.find(c => c.key === pivotRowField)?.label || pivotRowField}
                  </TableHead>
                  {excelPivot.cols.map(col => (
                    <TableHead key={col} className="text-xs font-semibold whitespace-nowrap text-center">{col}</TableHead>
                  ))}
                  {excelPivot.cols.length > 1 && <TableHead className="text-xs font-semibold whitespace-nowrap text-center bg-muted/80">Grand Total</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {excelPivot.rows.map(row => {
                  const rowTotal = excelPivot.cols.reduce((s, c) => s + (excelPivot.data[row]?.[c] || 0), 0);
                  return (
                    <TableRow key={row} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium whitespace-nowrap sticky left-0 bg-background z-10">{row}</TableCell>
                      {excelPivot.cols.map(col => (
                        <TableCell key={col} className="text-xs text-center font-mono">{formatPivotVal(excelPivot.data[row]?.[col] || 0)}</TableCell>
                      ))}
                      {excelPivot.cols.length > 1 && (
                        <TableCell className="text-xs text-center font-mono font-semibold bg-muted/30">{formatPivotVal(rowTotal)}</TableCell>
                      )}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell className="text-xs font-semibold sticky left-0 bg-muted/60 z-10">Grand Total</TableCell>
                  {excelPivot.cols.map(col => (
                    <TableCell key={col} className="text-xs text-center font-mono font-semibold">{formatPivotVal(excelPivot.grandTotals[col] || 0)}</TableCell>
                  ))}
                  {excelPivot.cols.length > 1 && (
                    <TableCell className="text-xs text-center font-mono font-bold bg-muted/80">{formatPivotVal(Object.values(excelPivot.grandTotals).reduce((s, v) => s + v, 0))}</TableCell>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
