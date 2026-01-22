import { Project, calculateTimeByParty, formatDuration, ResponsibilityParty } from "@/data/projectsData";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { teamLabels } from "@/data/teams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ClipboardList, Clock, Timer } from "lucide-react";

interface ChecklistDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const phaseLabels = {
  mint: "MINT",
  integration: "Integration",
  ms: "MS",
  completed: "Completed",
};

const phaseColors = {
  mint: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  integration: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  ms: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const ownerTeamLabels = {
  mint: "MINT Team",
  integration: "Integration Team",
  ms: "MS Team",
  manager: "Manager",
};

export const ChecklistDialog = ({
  project,
  open,
  onOpenChange,
}: ChecklistDialogProps) => {
  const { updateChecklist, toggleChecklistResponsibility } = useProjects();
  const { currentUser } = useAuth();

  if (!project || !currentUser) return null;

  const completedCount = project.checklist.filter((c) => c.completed).length;
  const totalCount = project.checklist.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const groupedChecklist = project.checklist.reduce((acc, item) => {
    if (!acc[item.phase]) acc[item.phase] = [];
    acc[item.phase].push(item);
    return acc;
  }, {} as Record<string, typeof project.checklist>);

  const canEditChecklistItem = (ownerTeam: string) => {
    if (currentUser.team === "manager") return true;
    return currentUser.team === ownerTeam;
  };

  const handleResponsibilityToggle = (checklistId: string, currentParty: ResponsibilityParty) => {
    const newParty = currentParty === "gokwik" ? "merchant" : "gokwik";
    toggleChecklistResponsibility(project.id, checklistId, newParty);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Checklist</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {project.merchantName}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedCount}/{totalCount} completed</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedChecklist).map(([phase, items]) => (
              <div key={phase}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className={phaseColors[phase as keyof typeof phaseColors]}>
                    {phaseLabels[phase as keyof typeof phaseLabels]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.filter((i) => i.completed).length}/{items.length}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Owner: {ownerTeamLabels[items[0]?.ownerTeam as keyof typeof ownerTeamLabels]}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => {
                    const timeStats = calculateTimeByParty(item.responsibilityLog);
                    const canEdit = canEditChecklistItem(item.ownerTeam);
                    
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={(checked) => {
                              if (canEdit) {
                                updateChecklist(project.id, item.id, checked as boolean);
                              }
                            }}
                            disabled={!canEdit}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                {item.title}
                              </span>
                              {item.completed && (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              )}
                            </div>
                            
                            {item.completedBy && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Completed by {item.completedBy}
                              </p>
                            )}
                            
                            {/* Time Stats */}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                <span>GK: {formatDuration(timeStats.gokwik)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Merchant: {formatDuration(timeStats.merchant)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Responsibility Toggle */}
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                              <Label 
                                htmlFor={`resp-${item.id}`} 
                                className={`text-xs ${item.currentResponsibility === "gokwik" ? "text-primary font-medium" : "text-muted-foreground"}`}
                              >
                                GoKwik
                              </Label>
                              <Switch
                                id={`resp-${item.id}`}
                                checked={item.currentResponsibility === "merchant"}
                                onCheckedChange={() => handleResponsibilityToggle(item.id, item.currentResponsibility)}
                                disabled={item.completed}
                              />
                              <Label 
                                htmlFor={`resp-${item.id}`} 
                                className={`text-xs ${item.currentResponsibility === "merchant" ? "text-amber-600 font-medium" : "text-muted-foreground"}`}
                              >
                                Merchant
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
