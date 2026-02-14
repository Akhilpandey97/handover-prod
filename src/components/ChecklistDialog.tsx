import { useMemo, useEffect, useRef } from "react";
import { Project, calculateTimeByParty, formatDuration, ResponsibilityParty } from "@/data/projectsData";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChecklistCommentThread } from "@/components/ChecklistCommentThread";
import { CheckCircle2, ClipboardList, Building2, Users, Minus, Lock, AlertCircle } from "lucide-react";

interface ChecklistDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ownerTeamLabels = {
  mint: "MINT Team",
  integration: "Integration Team",
  ms: "MS Team",
  manager: "Manager",
};

const teamColors = {
  mint: "bg-blue-500",
  integration: "bg-purple-500",
  ms: "bg-emerald-500",
  manager: "bg-primary",
};

export const ChecklistDialog = ({
  project,
  open,
  onOpenChange,
}: ChecklistDialogProps) => {
  const { updateChecklist, toggleChecklistResponsibility } = useProjects();
  const { currentUser } = useAuth();
  const { teamLabels, responsibilityLabels } = useLabels();

  // Dynamic team labels for checklist sections
  const ownerTeamLabelsFromCtx: Record<string, string> = {
    mint: teamLabels.mint || "MINT Team",
    integration: teamLabels.integration || "Integration Team",
    ms: teamLabels.ms || "MS Team",
    manager: teamLabels.manager || "Manager",
  };

  const checklist = project?.checklist || [];
  const completedCount = checklist.filter((c) => c.completed).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Check if all current team's checklist items are completed for transfer unlock notification
  const currentTeamChecklist = project ? checklist.filter(c => c.ownerTeam === project.currentOwnerTeam) : [];
  const allCurrentTeamDone = currentTeamChecklist.length > 0 && currentTeamChecklist.every(c => c.completed);
  const prevAllDoneRef = useRef(allCurrentTeamDone);

  useEffect(() => {
    if (allCurrentTeamDone && !prevAllDoneRef.current && open) {
      toast.success("🎉 All tasks complete! Transfer is now unlocked.", {
        duration: 5000,
        description: "You can now transfer this project to the next team.",
      });
    }
    prevAllDoneRef.current = allCurrentTeamDone;
  }, [allCurrentTeamDone, open]);

  if (!project || !currentUser) return null;

  // Group checklist by owner team
  const groupedByTeam = project.checklist.reduce((acc, item) => {
    const team = (item.ownerTeam || "").toLowerCase();
    if (!acc[team]) acc[team] = [];
    acc[team].push(item);
    return acc;
  }, {} as Record<string, typeof project.checklist>);

  // Normalize current user's team for comparison
  const userTeam = (currentUser.team || "").toLowerCase();

  // Order teams: current user's team first, then others
  const teamOrder = userTeam === "integration" 
    ? ["integration", "mint", "ms", "manager"]
    : userTeam === "mint"
    ? ["mint", "integration", "ms", "manager"]
    : userTeam === "ms"
    ? ["ms", "integration", "mint", "manager"]
    : ["mint", "integration", "ms", "manager"];

  const orderedTeams = teamOrder.filter(team => groupedByTeam[team]?.length > 0);

  // Calculate counts per team
  const teamCounts = Object.entries(groupedByTeam).reduce((acc, [team, items]) => {
    acc[team] = {
      completed: items.filter(i => i.completed).length,
      total: items.length,
    };
    return acc;
  }, {} as Record<string, { completed: number; total: number }>);

  // Compare teams case-insensitively
  const canEditChecklistItem = (ownerTeam: string) => {
    if (userTeam === "manager") return true;
    return userTeam === (ownerTeam || "").toLowerCase();
  };

  // Check if an item can be completed (sequential logic)
  const canCompleteItem = (team: string, itemIndex: number) => {
    const teamItems = groupedByTeam[team] || [];
    // Can complete if all previous items are completed
    for (let i = 0; i < itemIndex; i++) {
      if (!teamItems[i].completed) {
        return false;
      }
    }
    return true;
  };

  // Get the index of an item within its team group
  const getItemIndexInTeam = (team: string, itemId: string) => {
    const teamItems = groupedByTeam[team] || [];
    return teamItems.findIndex(item => item.id === itemId);
  };

  const handleResponsibilityChange = (checklistId: string, newParty: string) => {
    if (newParty && (newParty === "gokwik" || newParty === "merchant" || newParty === "neutral")) {
      toggleChecklistResponsibility(project.id, checklistId, newParty as ResponsibilityParty);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl">Project Checklist</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {project.merchantName}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Compact Progress Section */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Progress</span>
              <span className="font-bold text-sm">{completedCount}/{totalCount}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {orderedTeams.map((team) => {
                const count = teamCounts[team];
                const isComplete = count?.completed === count?.total;
                return (
                  <Badge 
                    key={team}
                    variant={team === userTeam ? "default" : "outline"}
                    className={`px-2 py-0.5 text-xs ${team === userTeam ? "" : "opacity-70"} ${isComplete ? "bg-emerald-500 text-white border-emerald-500" : ""}`}
                  >
                    {ownerTeamLabelsFromCtx[team] || team}: {count?.completed || 0}/{count?.total || 0}
                    {isComplete && <CheckCircle2 className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-amber-500/10 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span>Tasks must be completed in order</span>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-500/10 rounded px-2 py-1">
              <Lock className="h-3 w-3 text-indigo-500" />
              <span>Complete all team items to unlock <strong>Transfer</strong></span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-8">
            {orderedTeams.map((team) => {
              const items = groupedByTeam[team];
              const isUserTeam = team === userTeam || userTeam === "manager";
              const teamCount = teamCounts[team];
              const teamProgress = teamCount ? Math.round((teamCount.completed / teamCount.total) * 100) : 0;
              
              return (
                <div key={team} className={!isUserTeam ? "opacity-60" : ""}>
                  {/* Team Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg ${teamColors[team as keyof typeof teamColors]} flex items-center justify-center text-white font-bold text-sm`}>
                        {(ownerTeamLabelsFromCtx[team] || team).charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{ownerTeamLabelsFromCtx[team] || team}</h3>
                        <p className="text-xs text-muted-foreground">{teamCount?.completed}/{teamCount?.total} tasks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUserTeam && (
                        <Badge variant="default" className="text-xs">Your Tasks</Badge>
                      )}
                      <div className="w-24">
                        <Progress value={teamProgress} className="h-2" />
                      </div>
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-3 pl-2 border-l-2 border-border ml-4">
                    {items.map((item, index) => {
                      const timeStats = calculateTimeByParty(item.responsibilityLog);
                      const itemTeam = (item.ownerTeam || "").toLowerCase();
                      const canEdit = canEditChecklistItem(itemTeam);
                      const canComplete = canCompleteItem(itemTeam, index);
                      const isLocked = !canComplete && !item.completed;
                      
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-all ${
                            item.completed 
                              ? "bg-emerald-500/5 border-emerald-200 dark:border-emerald-800" 
                              : isLocked 
                                ? "bg-muted/30 border-border/50 opacity-60" 
                                : "bg-card border-border hover:border-primary/30 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Step Number & Checkbox */}
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono p-0">
                                {index + 1}
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      {isLocked ? (
                                        <div className="h-5 w-5 rounded border border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                                          <Lock className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                      ) : (
                                        <Checkbox
                                          checked={item.completed}
                                          onCheckedChange={(checked) => {
                                            if (canEdit && canComplete) {
                                              updateChecklist(project.id, item.id, checked as boolean);
                                            }
                                          }}
                                          disabled={!canEdit || isLocked}
                                          className="h-5 w-5"
                                        />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isLocked 
                                      ? "Complete previous tasks first" 
                                      : !canEdit 
                                        ? "Only team members can complete this" 
                                        : item.completed 
                                          ? "Click to mark as incomplete" 
                                          : "Click to mark as complete"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                  {item.title}
                                </span>
                                {item.completed && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                )}
                                {isLocked && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Locked
                                  </Badge>
                                )}
                              </div>
                              
                              {item.completedBy && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  ✓ Completed by {item.completedBy}
                                  {item.completedAt && ` on ${new Date(item.completedAt).toLocaleDateString()}`}
                                </p>
                              )}
                              
                              {/* Time Stats */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3 text-primary" />
                                  <span>{responsibilityLabels.gokwik}: {formatDuration(timeStats.gokwik)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-amber-500" />
                                  <span>{responsibilityLabels.merchant}: {formatDuration(timeStats.merchant)}</span>
                                </div>
                              </div>

                              {/* Comment Thread */}
                              <ChecklistCommentThread checklistItemId={item.id} />
                            </div>

                            {/* Responsibility Toggle */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">Pending with</span>
                              <ToggleGroup 
                                type="single" 
                                value={item.currentResponsibility}
                                onValueChange={(value) => handleResponsibilityChange(item.id, value)}
                                disabled={item.completed || isLocked}
                                className="gap-0 border rounded-lg overflow-hidden"
                              >
                                <ToggleGroupItem 
                                  value="gokwik" 
                                  aria-label={responsibilityLabels.gokwik}
                                  className="text-xs px-3 py-1.5 h-8 rounded-none data-[state=on]:bg-primary data-[state=on]:text-white"
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {responsibilityLabels.gokwik}
                                </ToggleGroupItem>
                                <ToggleGroupItem 
                                  value="neutral" 
                                  aria-label={responsibilityLabels.neutral}
                                  className="text-xs px-3 py-1.5 h-8 rounded-none border-x data-[state=on]:bg-muted"
                                >
                                  <Minus className="h-3 w-3" />
                                </ToggleGroupItem>
                                <ToggleGroupItem 
                                  value="merchant" 
                                  aria-label={responsibilityLabels.merchant}
                                  className="text-xs px-3 py-1.5 h-8 rounded-none data-[state=on]:bg-amber-500 data-[state=on]:text-white"
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  {responsibilityLabels.merchant}
                                </ToggleGroupItem>
                              </ToggleGroup>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
