import { useState, useEffect } from "react";
import { Project, ProjectLinks, ProjectDates, ProjectNotes } from "@/data/projectsData";
import { useLabels } from "@/contexts/LabelsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Calendar, Link2, FileText, Pencil } from "lucide-react";

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (project: Project) => void;
}

export const EditProjectDialog = ({
  project,
  open,
  onOpenChange,
  onSave,
}: EditProjectDialogProps) => {
  const { getLabel } = useLabels();
  const [editedProject, setEditedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (project) {
      setEditedProject({ ...project });
    }
  }, [project]);

  if (!editedProject) return null;

  const updateField = <K extends keyof Project>(field: K, value: Project[K]) => {
    setEditedProject((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const updateLinks = (field: keyof ProjectLinks, value: string) => {
    setEditedProject((prev) =>
      prev ? { ...prev, links: { ...prev.links, [field]: value } } : null
    );
  };

  const updateDates = (field: keyof ProjectDates, value: string) => {
    setEditedProject((prev) =>
      prev ? { ...prev, dates: { ...prev.dates, [field]: value } } : null
    );
  };

  const updateNotes = (field: keyof ProjectNotes, value: string) => {
    setEditedProject((prev) =>
      prev ? { ...prev, notes: { ...prev.notes, [field]: value } } : null
    );
  };

  const handleSave = () => {
    if (editedProject) {
      onSave(editedProject);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Edit Project</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {editedProject.merchantName}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="info" className="gap-1 text-xs">
                <Building2 className="h-3 w-3" />
                Info
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1 text-xs">
                <Link2 className="h-3 w-3" />
                Links
              </TabsTrigger>
              <TabsTrigger value="dates" className="gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                Dates
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1 text-xs">
                <FileText className="h-3 w-3" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-merchantName">{getLabel("field_merchant_name")}</Label>
                  <Input
                    id="edit-merchantName"
                    value={editedProject.merchantName}
                    onChange={(e) => updateField("merchantName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-mid">{getLabel("field_mid")}</Label>
                  <Input
                    id="edit-mid"
                    value={editedProject.mid}
                    onChange={(e) => updateField("mid", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-platform">{getLabel("field_platform")}</Label>
                  <Select
                    value={editedProject.platform}
                    onValueChange={(v) => updateField("platform", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Custom">Custom</SelectItem>
                      <SelectItem value="Shopify">Shopify</SelectItem>
                      <SelectItem value="Magento">Magento</SelectItem>
                      <SelectItem value="WooCommerce">WooCommerce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">{getLabel("field_category")}</Label>
                  <Input
                    id="edit-category"
                    value={editedProject.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-arr">{getLabel("field_arr")}</Label>
                  <Input
                    id="edit-arr"
                    type="number"
                    step="0.01"
                    value={editedProject.arr}
                    onChange={(e) => updateField("arr", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-txnsPerDay">{getLabel("field_txns_per_day")}</Label>
                  <Input
                    id="edit-txnsPerDay"
                    type="number"
                    value={editedProject.txnsPerDay}
                    onChange={(e) => updateField("txnsPerDay", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-aov">{getLabel("field_aov")}</Label>
                  <Input
                    id="edit-aov"
                    type="number"
                    value={editedProject.aov}
                    onChange={(e) => updateField("aov", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-salesSpoc">{getLabel("field_sales_spoc")}</Label>
                  <Input
                    id="edit-salesSpoc"
                    value={editedProject.salesSpoc}
                    onChange={(e) => updateField("salesSpoc", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-integrationType">{getLabel("field_integration_type")}</Label>
                  <Select
                    value={editedProject.integrationType}
                    onValueChange={(v) => updateField("integrationType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-pgOnboarding">{getLabel("field_pg_onboarding")}</Label>
                  <Input
                    id="edit-pgOnboarding"
                    value={editedProject.pgOnboarding}
                    onChange={(e) => updateField("pgOnboarding", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-goLivePercent">{getLabel("field_go_live_percent")}</Label>
                  <Input
                    id="edit-goLivePercent"
                    type="number"
                    min="0"
                    max="100"
                    value={editedProject.goLivePercent}
                    onChange={(e) => updateField("goLivePercent", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-brandUrl">{getLabel("field_brand_url")}</Label>
                <Input
                  id="edit-brandUrl"
                  type="url"
                  value={editedProject.links.brandUrl}
                  onChange={(e) => updateLinks("brandUrl", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jiraLink">{getLabel("field_jira_link")}</Label>
                <Input
                  id="edit-jiraLink"
                  type="url"
                  value={editedProject.links.jiraLink || ""}
                  onChange={(e) => updateLinks("jiraLink", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-brdLink">{getLabel("field_brd_link")}</Label>
                <Input
                  id="edit-brdLink"
                  type="url"
                  value={editedProject.links.brdLink || ""}
                  onChange={(e) => updateLinks("brdLink", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mintChecklistLink">{getLabel("field_mint_checklist_link")}</Label>
                <Input
                  id="edit-mintChecklistLink"
                  type="url"
                  value={editedProject.links.mintChecklistLink || ""}
                  onChange={(e) => updateLinks("mintChecklistLink", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-integrationChecklistLink">{getLabel("field_integration_checklist_link")}</Label>
                <Input
                  id="edit-integrationChecklistLink"
                  type="url"
                  value={editedProject.links.integrationChecklistLink || ""}
                  onChange={(e) => updateLinks("integrationChecklistLink", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-kickOffDate">{getLabel("field_kick_off_date")}</Label>
                <Input
                  id="edit-kickOffDate"
                  type="date"
                  value={editedProject.dates.kickOffDate}
                  onChange={(e) => updateDates("kickOffDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expectedGoLiveDate">{getLabel("field_expected_go_live_date")}</Label>
                <Input
                  id="edit-expectedGoLiveDate"
                  type="date"
                  value={editedProject.dates.expectedGoLiveDate || ""}
                  onChange={(e) => updateDates("expectedGoLiveDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goLiveDate">{getLabel("field_actual_go_live_date")}</Label>
                <Input
                  id="edit-goLiveDate"
                  type="date"
                  value={editedProject.dates.goLiveDate || ""}
                  onChange={(e) => updateDates("goLiveDate", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-mintNotes">{getLabel("field_mint_notes")}</Label>
                <Textarea
                  id="edit-mintNotes"
                  value={editedProject.notes.mintNotes || ""}
                  onChange={(e) => updateNotes("mintNotes", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-projectNotes">{getLabel("field_project_notes")}</Label>
                <Textarea
                  id="edit-projectNotes"
                  value={editedProject.notes.projectNotes || ""}
                  onChange={(e) => updateNotes("projectNotes", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-currentPhaseComment">{getLabel("field_current_phase_comment")}</Label>
                <Textarea
                  id="edit-currentPhaseComment"
                  value={editedProject.notes.currentPhaseComment || ""}
                  onChange={(e) => updateNotes("currentPhaseComment", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phase2Comment">{getLabel("field_phase2_comment")}</Label>
                <Textarea
                  id="edit-phase2Comment"
                  value={editedProject.notes.phase2Comment || ""}
                  onChange={(e) => updateNotes("phase2Comment", e.target.value)}
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};