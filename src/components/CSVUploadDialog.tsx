import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedProject {
  merchant_name: string;
  mid: string;
  platform: string;
  category: string;
  brand_url: string;
  arr: number;
  txns_per_day: number;
  aov: number;
  sales_spoc: string;
  mint_notes: string;
  project_notes: string;
  current_phase_comment: string;
  integration_type: string;
  pg_onboarding: string;
  jira_link: string;
  brd_link: string;
  kick_off_date: string;
  expected_go_live_date: string;
  go_live_percent: number;
  current_phase: string;
  current_owner_team: string;
}

interface ImportResult {
  success: boolean;
  merchantName: string;
  error?: string;
}

// Map CSV phase to valid enum values
const mapPhaseToEnum = (phase: string): string => {
  const phaseMap: Record<string, string> = {
    "feasibility analysis": "mint",
    "scoping": "mint",
    "api build": "mint",
    "api validation": "mint",
    "integration": "integration",
    "sandbox testing": "integration",
    "production testing": "integration",
    "prod testing": "integration",
    "go-live": "ms",
    "golive": "ms",
    "completed": "completed",
  };
  const normalized = phase.toLowerCase().trim();
  return phaseMap[normalized] || "mint";
};

// Map phase to owner team
const mapPhaseToTeam = (phase: string): string => {
  const mapped = mapPhaseToEnum(phase);
  if (mapped === "integration") return "integration";
  if (mapped === "ms" || mapped === "completed") return "ms";
  return "mint";
};

// Parse CSV content
const parseCSV = (content: string): ParsedProject[] => {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const projects: ParsedProject[] = [];
  let currentRow = "";

  for (let i = 1; i < lines.length; i++) {
    currentRow += lines[i];
    
    // Check if this is a complete row (even number of quotes means complete)
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      currentRow += "\n";
      continue;
    }

    const values = parseCSVLine(currentRow);
    currentRow = "";

    if (values.length < 5) continue;

    const getVal = (name: string): string => {
      const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      return idx >= 0 ? (values[idx] || "").trim() : "";
    };

    const merchant = getVal("merchant");
    if (!merchant) continue;

    const mid = getVal("mid") || `mid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const kickOffDate = getVal("scoping_kick_off") || new Date().toISOString().split("T")[0];
    const goLiveDate = getVal("go_live");
    const phase = getVal("project_phase") || getVal("phase_comment") || "mint";

    projects.push({
      merchant_name: merchant,
      mid,
      platform: getVal("platform") || "Custom",
      category: getVal("category") || "",
      brand_url: getVal("brand_url") || "",
      arr: parseFloat(getVal("arr_cr")) || 0,
      txns_per_day: parseInt(getVal("txns_per_day")) || 0,
      aov: parseFloat(getVal("aov")) || 0,
      sales_spoc: getVal("sales_spoc") || "",
      mint_notes: getVal("mint_notes") || "",
      project_notes: getVal("project_notes") || "",
      current_phase_comment: getVal("phase_comment") || "",
      integration_type: getVal("integration_type") || "Standard",
      pg_onboarding: getVal("pg_onboarding") || "",
      jira_link: getVal("project_jira") || "",
      brd_link: getVal("brd_link") || "",
      kick_off_date: kickOffDate,
      expected_go_live_date: goLiveDate || "",
      go_live_percent: parseInt(getVal("go_live_percent")) || 0,
      current_phase: mapPhaseToEnum(phase),
      current_owner_team: mapPhaseToTeam(phase),
    });
  }

  return projects;
};

// Parse a single CSV line handling quoted fields
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
};

// Default checklist items for new projects
const mintChecklistItems = [
  "Requirement gathering",
  "Feasibility Analysis",
  "BRD Details",
  "Technical Scoping",
  "Technical Walkthrough",
  "API Validation",
  "LCNC Config",
  "Create JIRA",
  "Transfer to Integration",
];

const integrationChecklistItems = [
  "BRD Validation",
  "Integration Checklist",
  "Sandbox Testing",
  "Production Testing",
  "Dashboard Walkthrough with MS",
  "Go-Live",
];

export const CSVUploadDialog = ({ open, onOpenChange }: CSVUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setResults([]);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResults([]);

    try {
      const content = await file.text();
      const projects = parseCSV(content);

      if (projects.length === 0) {
        toast.error("No valid projects found in CSV");
        setImporting(false);
        return;
      }

      const importResults: ImportResult[] = [];

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        setProgress(Math.round(((i + 1) / projects.length) * 100));

        try {
          // Check if project already exists by MID
          const { data: existing } = await supabase
            .from("projects")
            .select("id")
            .eq("mid", project.mid)
            .maybeSingle();

          if (existing) {
            importResults.push({
              success: false,
              merchantName: project.merchant_name,
              error: "Already exists (duplicate MID)",
            });
            continue;
          }

          // Insert project
          const { data: newProject, error: projectError } = await supabase
            .from("projects")
            .insert({
              merchant_name: project.merchant_name,
              mid: project.mid,
              platform: project.platform,
              category: project.category,
              brand_url: project.brand_url,
              arr: project.arr,
              txns_per_day: project.txns_per_day,
              aov: project.aov,
              sales_spoc: project.sales_spoc,
              mint_notes: project.mint_notes,
              project_notes: project.project_notes,
              current_phase_comment: project.current_phase_comment,
              integration_type: project.integration_type,
              pg_onboarding: project.pg_onboarding,
              jira_link: project.jira_link,
              brd_link: project.brd_link,
              kick_off_date: project.kick_off_date,
              expected_go_live_date: project.expected_go_live_date || null,
              go_live_percent: project.go_live_percent,
              current_phase: project.current_phase as any,
              current_owner_team: project.current_owner_team as any,
              current_responsibility: "neutral",
              pending_acceptance: false,
            })
            .select()
            .single();

          if (projectError) throw projectError;

          // Insert checklist items
          const checklistItems = [
            ...mintChecklistItems.map((title, idx) => ({
              project_id: newProject.id,
              title,
              phase: "mint" as const,
              owner_team: "mint" as const,
              current_responsibility: "neutral" as const,
              sort_order: idx,
              completed: false,
            })),
            ...integrationChecklistItems.map((title, idx) => ({
              project_id: newProject.id,
              title,
              phase: "integration" as const,
              owner_team: "integration" as const,
              current_responsibility: "neutral" as const,
              sort_order: mintChecklistItems.length + idx,
              completed: false,
            })),
          ];

          const { error: checklistError } = await supabase
            .from("checklist_items")
            .insert(checklistItems);

          if (checklistError) {
            console.error("Checklist error:", checklistError);
          }

          // Insert initial responsibility log
          await supabase.from("project_responsibility_logs").insert({
            project_id: newProject.id,
            party: "neutral",
            phase: project.current_phase as any,
            started_at: new Date().toISOString(),
          });

          importResults.push({
            success: true,
            merchantName: project.merchant_name,
          });
        } catch (error: any) {
          console.error("Import error:", error);
          importResults.push({
            success: false,
            merchantName: project.merchant_name,
            error: error.message || "Unknown error",
          });
        }
      }

      setResults(importResults);
      
      const successCount = importResults.filter(r => r.success).length;
      const failCount = importResults.filter(r => !r.success).length;
      
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        toast.success(`Imported ${successCount} projects successfully${failCount > 0 ? `, ${failCount} failed` : ""}`);
      } else {
        toast.error("No projects were imported");
      }
    } catch (error) {
      console.error("CSV parsing error:", error);
      toast.error("Failed to parse CSV file");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setResults([]);
      setProgress(0);
      onOpenChange(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Projects from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with project data. Duplicate MIDs will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div
            onClick={() => !importing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            } ${importing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Click to select CSV file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or drag and drop
                </p>
              </>
            )}
          </div>

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing projects...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                {successCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {successCount} imported
                  </span>
                )}
                {failCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {failCount} failed
                  </span>
                )}
              </div>

              {failCount > 0 && (
                <ScrollArea className="h-32 border rounded-md p-2">
                  {results
                    .filter(r => !r.success)
                    .map((r, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 text-sm">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium">{r.merchantName}:</span>{" "}
                          <span className="text-muted-foreground">{r.error}</span>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {results.length > 0 ? "Close" : "Cancel"}
            </Button>
            {!results.length && (
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? "Importing..." : "Import Projects"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
