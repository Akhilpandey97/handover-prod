import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Mail } from "lucide-react";
import { Project, createDefaultChecklist } from "@/data/projectsData";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParsedEmail {
  id: string;
  gmail_message_id: string;
  subject: string;
  sender: string;
  received_at: string;
  brand_name: string | null;
  brand_url: string | null;
  platform: string | null;
  sub_platform: string | null;
  arr: number | null;
  category: string | null;
  txns_per_day: number | null;
  aov: number | null;
  merchant_size: string | null;
  city: string | null;
  sales_notes: string | null;
  parsed_fields: Record<string, string> | null;
  status: string;
  project_id: string | null;
  created_at: string;
}

// Email fields that can be mapped
const EMAIL_FIELDS = [
  { key: "brand_name", label: "Brand Name" },
  { key: "brand_url", label: "Brand URL" },
  { key: "platform", label: "Platform" },
  { key: "sub_platform", label: "Sub Platform" },
  { key: "arr", label: "ARR" },
  { key: "category", label: "Category" },
  { key: "txns_per_day", label: "Txns/Day" },
  { key: "aov", label: "AOV" },
  { key: "merchant_size", label: "Merchant Size" },
  { key: "city", label: "City" },
  { key: "sales_notes", label: "Sales Notes" },
] as const;

// Project fields that can receive mapped values
const PROJECT_FIELDS = [
  { key: "merchantName", label: "Merchant Name", type: "text" },
  { key: "mid", label: "MID", type: "text" },
  { key: "platform", label: "Platform", type: "text" },
  { key: "arr", label: "ARR", type: "number" },
  { key: "txnsPerDay", label: "Txns/Day", type: "number" },
  { key: "aov", label: "AOV", type: "number" },
  { key: "category", label: "Category", type: "text" },
  { key: "salesSpoc", label: "Sales SPOC", type: "text" },
  { key: "integrationType", label: "Integration Type", type: "text" },
  { key: "pgOnboarding", label: "PG Onboarding", type: "text" },
  { key: "brandUrl", label: "Brand URL", type: "text" },
  { key: "projectNotes", label: "Project Notes", type: "text" },
] as const;

function getEmailFieldValue(email: ParsedEmail, key: string): string {
  const val = (email as any)[key];
  if (val === null || val === undefined) return "";
  return String(val);
}

// Default mapping from email fields to project fields
const DEFAULT_MAPPING: Record<string, string> = {
  brand_name: "merchantName",
  brand_url: "brandUrl",
  platform: "platform",
  arr: "arr",
  category: "category",
  txns_per_day: "txnsPerDay",
  aov: "aov",
  sales_notes: "projectNotes",
};

interface EmailToProjectDialogProps {
  email: ParsedEmail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export const EmailToProjectDialog = ({ email, open, onOpenChange, onProjectCreated }: EmailToProjectDialogProps) => {
  const { addProject } = useProjects();
  const { currentUser } = useAuth();

  // Mapping: emailFieldKey -> projectFieldKey
  const [mapping, setMapping] = useState<Record<string, string>>(DEFAULT_MAPPING);

  // Editable project field overrides
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const updateMapping = (emailKey: string, projectKey: string) => {
    setMapping(prev => ({ ...prev, [emailKey]: projectKey }));
  };

  // Compute final project values from mapping + overrides
  const getFinalValue = (projectKey: string): string => {
    if (overrides[projectKey] !== undefined) return overrides[projectKey];
    // Find if any email field is mapped to this project field
    for (const [eKey, pKey] of Object.entries(mapping)) {
      if (pKey === projectKey) {
        return getEmailFieldValue(email, eKey);
      }
    }
    return "";
  };

  const handleCreate = async () => {
    const merchantName = getFinalValue("merchantName");
    if (!merchantName) {
      toast.error("Merchant Name is required");
      return;
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      merchantName,
      mid: getFinalValue("mid") || `EMAIL-${email.gmail_message_id.substring(0, 8)}`,
      currentPhase: "mint",
      currentOwnerTeam: "mint",
      arr: Number(getFinalValue("arr")) || 0,
      txnsPerDay: Number(getFinalValue("txnsPerDay")) || 0,
      aov: Number(getFinalValue("aov")) || 0,
      platform: getFinalValue("platform") || "Custom",
      integrationType: getFinalValue("integrationType") || "Standard",
      salesSpoc: getFinalValue("salesSpoc") || "",
      category: getFinalValue("category") || "",
      pgOnboarding: getFinalValue("pgOnboarding") || "",
      currentResponsibility: "neutral",
      pendingAcceptance: false,
      projectState: "not_started",
      goLivePercent: 0,
      dates: {
        kickOffDate: new Date().toISOString().split("T")[0],
        expectedGoLiveDate: "",
        goLiveDate: "",
      },
      links: {
        brandUrl: getFinalValue("brandUrl") || "",
        jiraLink: "",
        brdLink: "",
        mintChecklistLink: "",
        integrationChecklistLink: "",
      },
      notes: {
        mintNotes: "",
        projectNotes: getFinalValue("projectNotes") || "",
        currentPhaseComment: "Created from email — needs manager review",
        phase2Comment: "",
      },
      checklist: createDefaultChecklist(),
      transferHistory: [],
      responsibilityLog: [{
        id: `r-${Date.now()}`,
        party: "gokwik" as const,
        startedAt: new Date().toISOString(),
        phase: "mint" as const,
      }],
      assignedOwner: undefined,
      assignedOwnerName: undefined,
    };

    addProject(newProject);

    // Update email status
    await supabase
      .from("parsed_emails")
      .update({ status: "project_created", project_id: newProject.id })
      .eq("id", email.id);

    toast.success(`Project "${merchantName}" created — assign an owner from Projects tab`);
    onOpenChange(false);
    onProjectCreated();
  };

  // Parsed fields from email (extra fields beyond the standard ones)
  const extraParsedFields = email.parsed_fields
    ? Object.entries(email.parsed_fields).filter(([k]) => !EMAIL_FIELDS.some(f => f.key === k))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Map Email to Project — {email.brand_name || "Untitled"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-5">
            {/* Field Mapping Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Field Mapping</h4>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr,auto,1fr,1fr] gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 border-b">
                  <span>Email Field</span>
                  <span></span>
                  <span>Maps To</span>
                  <span>Value</span>
                </div>
                {EMAIL_FIELDS.map(ef => {
                  const emailVal = getEmailFieldValue(email, ef.key);
                  const mappedTo = mapping[ef.key] || "";
                  return (
                    <div key={ef.key} className="grid grid-cols-[1fr,auto,1fr,1fr] gap-2 items-center px-3 py-2 border-b last:border-b-0 hover:bg-muted/20">
                      <div className="text-sm">
                        <span className="font-medium">{ef.label}</span>
                        {emailVal && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 max-w-[120px] truncate">
                            {emailVal}
                          </Badge>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={mappedTo} onValueChange={(v) => updateMapping(ef.key, v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">Skip</SelectItem>
                          {PROJECT_FIELDS.map(pf => (
                            <SelectItem key={pf.key} value={pf.key}>{pf.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground truncate">
                        {mappedTo && mappedTo !== "__skip__" ? emailVal || "—" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Extra Parsed Fields */}
            {extraParsedFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Additional Parsed Fields</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extraParsedFields.map(([key, value]) => (
                    <div key={key} className="bg-muted/30 rounded-md p-2 text-xs">
                      <span className="text-muted-foreground">{key}:</span>{" "}
                      <span className="font-medium">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Field Overrides */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Review & Override Project Fields</h4>
              <div className="grid grid-cols-2 gap-3">
                {PROJECT_FIELDS.map(pf => {
                  const val = overrides[pf.key] !== undefined ? overrides[pf.key] : getFinalValue(pf.key);
                  return (
                    <div key={pf.key}>
                      <Label className="text-xs text-muted-foreground">{pf.label}</Label>
                      <Input
                        className="h-8 text-sm mt-0.5"
                        type={pf.type === "number" ? "number" : "text"}
                        value={val}
                        onChange={e => setOverrides(prev => ({ ...prev, [pf.key]: e.target.value }))}
                        placeholder={pf.label}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
