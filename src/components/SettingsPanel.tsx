import { useState } from "react";
import { useLabels } from "@/contexts/LabelsContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, RotateCcw, Settings, Palette } from "lucide-react";

interface LabelGroup {
  title: string;
  description: string;
  keys: { key: string; label: string }[];
}

const LABEL_GROUPS: LabelGroup[] = [
  {
    title: "General",
    description: "Application name and branding",
    keys: [
      { key: "app_title", label: "Dashboard Title" },
      { key: "app_subtitle", label: "Dashboard Subtitle" },
      { key: "org_name", label: "Organisation Name" },
    ],
  },
  {
    title: "Team Names",
    description: "Labels for each team/department",
    keys: [
      { key: "team_mint", label: "Team 1 (Presales)" },
      { key: "team_integration", label: "Team 2 (Integration)" },
      { key: "team_ms", label: "Team 3 (Post-Sales)" },
      { key: "team_manager", label: "Manager Role" },
    ],
  },
  {
    title: "Responsibility Parties",
    description: "Labels for internal vs external ownership",
    keys: [
      { key: "responsibility_internal", label: "Internal Party" },
      { key: "responsibility_external", label: "External Party" },
      { key: "responsibility_neutral", label: "Neutral State" },
    ],
  },
  {
    title: "Project Phases",
    description: "Names for each workflow phase",
    keys: [
      { key: "phase_mint", label: "Phase 1" },
      { key: "phase_integration", label: "Phase 2" },
      { key: "phase_ms", label: "Phase 3" },
      { key: "phase_completed", label: "Phase 4 (Final)" },
    ],
  },
  {
    title: "Project States",
    description: "Status labels for projects",
    keys: [
      { key: "state_not_started", label: "State: Not Started" },
      { key: "state_on_hold", label: "State: On Hold" },
      { key: "state_in_progress", label: "State: Active" },
      { key: "state_live", label: "State: Live/Complete" },
      { key: "state_blocked", label: "State: Blocked" },
    ],
  },
  {
    title: "Field Labels",
    description: "Labels for project data fields shown across the app",
    keys: [
      { key: "field_merchant_name", label: "Client/Merchant Name" },
      { key: "field_mid", label: "Client ID Field" },
      { key: "field_arr", label: "Revenue Metric" },
      { key: "field_platform", label: "Platform Label" },
      { key: "field_integration_type", label: "Integration Type Label" },
      { key: "field_sales_spoc", label: "Sales Contact Label" },
      { key: "field_assigned_owner", label: "Owner Label" },
      { key: "field_project_notes", label: "Notes Label" },
      { key: "field_category", label: "Category Label" },
      { key: "field_txns_per_day", label: "Txns/Day Label" },
      { key: "field_aov", label: "AOV Label" },
      { key: "field_pg_onboarding", label: "PG Onboarding Label" },
      { key: "field_go_live_percent", label: "Go Live % Label" },
    ],
  },
  {
    title: "Link Labels",
    description: "Labels for project link fields",
    keys: [
      { key: "field_brand_url", label: "Brand URL Label" },
      { key: "field_jira_link", label: "JIRA Link Label" },
      { key: "field_brd_link", label: "BRD Link Label" },
      { key: "field_mint_checklist_link", label: "MINT Checklist Link Label" },
      { key: "field_integration_checklist_link", label: "Integration Checklist Link Label" },
    ],
  },
  {
    title: "Date Labels",
    description: "Labels for project date fields",
    keys: [
      { key: "field_kick_off_date", label: "Start Date Label" },
      { key: "field_expected_go_live_date", label: "Expected Go Live Date Label" },
      { key: "field_actual_go_live_date", label: "Actual Go Live Date Label" },
    ],
  },
  {
    title: "Notes Labels",
    description: "Labels for project notes and comments",
    keys: [
      { key: "field_project_notes", label: "Project Notes Label" },
      { key: "field_mint_notes", label: "MINT Notes Label" },
      { key: "field_current_phase_comment", label: "Current Phase Comment Label" },
      { key: "field_phase2_comment", label: "Phase 2 Comment Label" },
    ],
  },
  {
    title: "Email Monitoring",
    description: "Configure the email address and subject keywords for auto-parsing new brand onboarding emails",
    keys: [
      { key: "email_monitor_address", label: "Sender Email Address (emails FROM this address)" },
      { key: "email_subject_keywords", label: "Subject Keywords (comma-separated)" },
    ],
  },
];

interface ColorLabelGroup {
  title: string;
  description: string;
  keys: { key: string; label: string }[];
}

const COLOR_GROUPS: ColorLabelGroup[] = [
  {
    title: "Team Badge Colours",
    description: "Set the badge colour for each team across project cards",
    keys: [
      { key: "color_team_mint_badge", label: "Team 1 (Presales) Badge" },
      { key: "color_team_integration_badge", label: "Team 2 (Integration) Badge" },
      { key: "color_team_ms_badge", label: "Team 3 (Post-Sales) Badge" },
      { key: "color_team_completed_badge", label: "Completed Badge" },
    ],
  },
  {
    title: "Card Background Colours",
    description: "Set the card tint colour for each team's projects",
    keys: [
      { key: "color_card_mint_bg", label: "Team 1 Card Background" },
      { key: "color_card_integration_bg", label: "Team 2 Card Background" },
      { key: "color_card_ms_bg", label: "Team 3 Card Background" },
      { key: "color_card_completed_bg", label: "Completed Card Background" },
    ],
  },
  {
    title: "Project State Badge Colours",
    description: "Set the colour for each project state badge",
    keys: [
      { key: "color_state_not_started", label: "Not Started" },
      { key: "color_state_on_hold", label: "On Hold" },
      { key: "color_state_in_progress", label: "In Progress" },
      { key: "color_state_live", label: "Live" },
      { key: "color_state_blocked", label: "Blocked" },
    ],
  },
];

export const SettingsPanel = () => {
  const { labels, updateLabels } = useLabels();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const getValue = (key: string) => draft[key] ?? labels[key] ?? "";

  const handleChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (Object.keys(draft).length === 0) {
      toast.info("No changes to save");
      return;
    }
    setIsSaving(true);
    try {
      await updateLabels(draft);
      setDraft({});
      toast.success("Labels updated! Changes apply globally across the app.");
    } catch {
      toast.error("Failed to save labels");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({});
    toast.info("Reverted unsaved changes");
  };

  const hasChanges = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Global Labels & Customisation
              </CardTitle>
              <CardDescription>
                Edit labels below to white-label the app for your organisation and industry. Changes apply everywhere instantly.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {hasChanges && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {LABEL_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <Separator className="mb-6" />}
              <h3 className="text-base font-semibold mb-1">{group.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{group.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <Input
                      id={key}
                      value={getValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className={draft[key] !== undefined ? "border-primary ring-1 ring-primary/20" : ""}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Colour Customisation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Colours & Branding
          </CardTitle>
          <CardDescription>
            Customise the colours of team badges, card backgrounds, and state indicators across the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {COLOR_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <Separator className="mb-6" />}
              <h3 className="text-base font-semibold mb-1">{group.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{group.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id={key}
                        value={getValue(key)}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                      />
                      <Input
                        value={getValue(key)}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className={`font-mono text-xs h-10 ${draft[key] !== undefined ? "border-primary ring-1 ring-primary/20" : ""}`}
                        placeholder="#000000"
                      />
                    </div>
                    {/* Preview */}
                    <div
                      className="h-6 rounded-md border border-border/50"
                      style={{ backgroundColor: getValue(key) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
