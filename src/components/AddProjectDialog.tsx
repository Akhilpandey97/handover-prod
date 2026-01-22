import { useState } from "react";
import { createDefaultProject, Project, ProjectLinks, ProjectDates, ProjectNotes } from "@/data/projectsData";
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
import { Building2, Calendar, DollarSign, Link2, FileText } from "lucide-react";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (project: Project) => void;
}

export const AddProjectDialog = ({
  open,
  onOpenChange,
  onSave,
}: AddProjectDialogProps) => {
  const [project, setProject] = useState<Project>(createDefaultProject());

  const updateField = <K extends keyof Project>(field: K, value: Project[K]) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const updateLinks = (field: keyof ProjectLinks, value: string) => {
    setProject((prev) => ({
      ...prev,
      links: { ...prev.links, [field]: value },
    }));
  };

  const updateDates = (field: keyof ProjectDates, value: string) => {
    setProject((prev) => ({
      ...prev,
      dates: { ...prev.dates, [field]: value },
    }));
  };

  const updateNotes = (field: keyof ProjectNotes, value: string) => {
    setProject((prev) => ({
      ...prev,
      notes: { ...prev.notes, [field]: value },
    }));
  };

  const handleSave = () => {
    if (!project.merchantName.trim() || !project.mid.trim()) {
      return;
    }
    onSave(project);
    setProject(createDefaultProject());
    onOpenChange(false);
  };

  const handleCancel = () => {
    setProject(createDefaultProject());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span>Add New Project</span>
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
                  <Label htmlFor="merchantName">Merchant Name *</Label>
                  <Input
                    id="merchantName"
                    value={project.merchantName}
                    onChange={(e) => updateField("merchantName", e.target.value)}
                    placeholder="Enter merchant name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mid">MID *</Label>
                  <Input
                    id="mid"
                    value={project.mid}
                    onChange={(e) => updateField("mid", e.target.value)}
                    placeholder="Enter MID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={project.platform}
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
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={project.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="Enter category"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="arr">ARR (cr)</Label>
                  <Input
                    id="arr"
                    type="number"
                    step="0.01"
                    value={project.arr}
                    onChange={(e) => updateField("arr", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="txnsPerDay">Txns/Day</Label>
                  <Input
                    id="txnsPerDay"
                    type="number"
                    value={project.txnsPerDay}
                    onChange={(e) => updateField("txnsPerDay", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aov">AOV (₹)</Label>
                  <Input
                    id="aov"
                    type="number"
                    value={project.aov}
                    onChange={(e) => updateField("aov", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salesSpoc">Sales SPOC</Label>
                  <Input
                    id="salesSpoc"
                    value={project.salesSpoc}
                    onChange={(e) => updateField("salesSpoc", e.target.value)}
                    placeholder="Enter sales SPOC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="integrationType">Integration Type</Label>
                  <Select
                    value={project.integrationType}
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

              <div className="space-y-2">
                <Label htmlFor="pgOnboarding">PG Onboarding</Label>
                <Input
                  id="pgOnboarding"
                  value={project.pgOnboarding}
                  onChange={(e) => updateField("pgOnboarding", e.target.value)}
                  placeholder="Enter PG name"
                />
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandUrl">Brand URL</Label>
                <Input
                  id="brandUrl"
                  type="url"
                  value={project.links.brandUrl}
                  onChange={(e) => updateLinks("brandUrl", e.target.value)}
                  placeholder="https://www.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jiraLink">JIRA Link</Label>
                <Input
                  id="jiraLink"
                  type="url"
                  value={project.links.jiraLink || ""}
                  onChange={(e) => updateLinks("jiraLink", e.target.value)}
                  placeholder="https://jira.atlassian.net/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brdLink">BRD Link</Label>
                <Input
                  id="brdLink"
                  type="url"
                  value={project.links.brdLink || ""}
                  onChange={(e) => updateLinks("brdLink", e.target.value)}
                  placeholder="https://docs.google.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mintChecklistLink">MINT Checklist Link</Label>
                <Input
                  id="mintChecklistLink"
                  type="url"
                  value={project.links.mintChecklistLink || ""}
                  onChange={(e) => updateLinks("mintChecklistLink", e.target.value)}
                  placeholder="https://docs.google.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="integrationChecklistLink">Integration Checklist Link</Label>
                <Input
                  id="integrationChecklistLink"
                  type="url"
                  value={project.links.integrationChecklistLink || ""}
                  onChange={(e) => updateLinks("integrationChecklistLink", e.target.value)}
                  placeholder="https://docs.google.com/..."
                />
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kickOffDate">Kick Off Date</Label>
                <Input
                  id="kickOffDate"
                  type="date"
                  value={project.dates.kickOffDate}
                  onChange={(e) => updateDates("kickOffDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedGoLiveDate">Expected Go Live Date</Label>
                <Input
                  id="expectedGoLiveDate"
                  type="date"
                  value={project.dates.expectedGoLiveDate || ""}
                  onChange={(e) => updateDates("expectedGoLiveDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goLiveDate">Actual Go Live Date</Label>
                <Input
                  id="goLiveDate"
                  type="date"
                  value={project.dates.goLiveDate || ""}
                  onChange={(e) => updateDates("goLiveDate", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mintNotes">MINT Notes</Label>
                <Textarea
                  id="mintNotes"
                  value={project.notes.mintNotes || ""}
                  onChange={(e) => updateNotes("mintNotes", e.target.value)}
                  placeholder="Add MINT team notes..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectNotes">Project Notes</Label>
                <Textarea
                  id="projectNotes"
                  value={project.notes.projectNotes || ""}
                  onChange={(e) => updateNotes("projectNotes", e.target.value)}
                  placeholder="Add general project notes..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPhaseComment">Current Phase Comment</Label>
                <Textarea
                  id="currentPhaseComment"
                  value={project.notes.currentPhaseComment || ""}
                  onChange={(e) => updateNotes("currentPhaseComment", e.target.value)}
                  placeholder="Add comments for current phase..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase2Comment">Phase 2 Comment</Label>
                <Textarea
                  id="phase2Comment"
                  value={project.notes.phase2Comment || ""}
                  onChange={(e) => updateNotes("phase2Comment", e.target.value)}
                  placeholder="Add comments for phase 2..."
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!project.merchantName.trim() || !project.mid.trim()}>
            Add Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
