import { useMemo, useState } from "react";
import { Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePhaseRules, type PhaseRule } from "@/hooks/usePhaseRules";
import { useLabels } from "@/contexts/LabelsContext";
import type { ProjectPhase } from "@/data/projectsData";

const EMPTY: Omit<PhaseRule, "id"> = {
  name: "",
  requiredTitles: [],
  matchMode: "all",
  targetPhase: "integration",
  priority: 0,
  isActive: true,
};

export const PhaseRulesManager = () => {
  const { rules, isLoading, saveRule, deleteRule } = usePhaseRules();
  const { phaseLabels } = useLabels();
  const { toast } = useToast();
  const [draft, setDraft] = useState<(Omit<PhaseRule, "id"> & { id?: string }) | null>(null);
  const [titlesText, setTitlesText] = useState("");

  const phaseOptions = useMemo(
    () => (["mint", "integration", "ms", "completed"] as ProjectPhase[]),
    [],
  );

  const startNew = () => {
    setDraft({ ...EMPTY });
    setTitlesText("");
  };

  const startEdit = (rule: PhaseRule) => {
    setDraft({ ...rule });
    setTitlesText(rule.requiredTitles.join("\n"));
  };

  const handleSave = async () => {
    if (!draft) return;
    const requiredTitles = titlesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!draft.name.trim() || requiredTitles.length === 0) {
      toast({
        title: "Missing details",
        description: "Give the rule a name and at least one checklist item.",
        variant: "destructive",
      });
      return;
    }
    try {
      await saveRule({ ...draft, requiredTitles });
      toast({ title: "Rule saved", description: `"${draft.name}" is now active.` });
      setDraft(null);
    } catch {
      toast({ title: "Could not save rule", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Workflow className="h-4 w-4" /> Phase Rules
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Move a project to a phase automatically once specific checklist items are complete.
            Higher priority rules win when several match.
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New rule
        </Button>
      </div>

      {draft && (
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rule name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Scoping complete → Integration"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target phase</Label>
              <Select
                value={draft.targetPhase}
                onValueChange={(value) => setDraft({ ...draft, targetPhase: value as ProjectPhase })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phaseOptions.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phaseLabels[phase] || phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Checklist items (one per line, exact titles)</Label>
            <Textarea
              rows={4}
              value={titlesText}
              onChange={(e) => setTitlesText(e.target.value)}
              placeholder={"Technical Scoping\nCreate JIRA"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Match</Label>
              <Select
                value={draft.matchMode}
                onValueChange={(value) => setDraft({ ...draft, matchMode: value as "all" | "any" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items complete</SelectItem>
                  <SelectItem value="any">Any item complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
              />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save rule
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No phase rules yet. Projects keep their manually set phase.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3"
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => startEdit(rule)}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{rule.name}</span>
                  {!rule.isActive && (
                    <Badge variant="outline" className="text-[10px]">
                      Paused
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    P{rule.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rule.matchMode === "all" ? "All of" : "Any of"}: {rule.requiredTitles.join(", ")} →{" "}
                  <span className="font-medium text-foreground">
                    {phaseLabels[rule.targetPhase] || rule.targetPhase}
                  </span>
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => void deleteRule(rule.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhaseRulesManager;
