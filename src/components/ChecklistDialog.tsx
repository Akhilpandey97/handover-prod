import { useState } from "react";
import { Project, calculateTimeByParty, formatDuration, ResponsibilityParty } from "@/data/projectsData";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CheckCircle2, ClipboardList, Clock, Timer, MessageSquare, Send, Building2, Users, Minus } from "lucide-react";

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
  const { updateChecklist, toggleChecklistResponsibility, updateChecklistComment } = useProjects();
  const { currentUser } = useAuth();
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>("");

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

  const handleResponsibilityChange = (checklistId: string, newParty: string) => {
    if (newParty && (newParty === "gokwik" || newParty === "merchant" || newParty === "neutral")) {
      toggleChecklistResponsibility(project.id, checklistId, newParty as ResponsibilityParty);
    }
  };

  const handleCommentSave = (checklistId: string) => {
    if (commentText.trim()) {
      updateChecklistComment(project.id, checklistId, commentText.trim());
    }
    setEditingComment(null);
    setCommentText("");
  };

  const startEditingComment = (checklistId: string, existingComment?: string) => {
    setEditingComment(checklistId);
    setCommentText(existingComment || "");
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

                            {/* Comment Section */}
                            <div className="mt-3 pt-2 border-t">
                              {editingComment === item.id ? (
                                <div className="flex gap-2">
                                  <Textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="min-h-[60px] text-xs"
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleCommentSave(item.id)}
                                      className="h-7 px-2"
                                    >
                                      <Send className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingComment(null);
                                        setCommentText("");
                                      }}
                                      className="h-7 px-2"
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {item.comment ? (
                                    <div 
                                      className="text-xs p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                                      onClick={() => startEditingComment(item.id, item.comment)}
                                    >
                                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                        <MessageSquare className="h-3 w-3" />
                                        <span className="font-medium">{item.commentBy}</span>
                                        {item.commentAt && (
                                          <span>• {new Date(item.commentAt).toLocaleDateString()}</span>
                                        )}
                                      </div>
                                      <p className="text-foreground">{item.comment}</p>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startEditingComment(item.id)}
                                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      Add comment
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Responsibility Toggle - 3 states */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <ToggleGroup 
                              type="single" 
                              value={item.currentResponsibility}
                              onValueChange={(value) => handleResponsibilityChange(item.id, value)}
                              disabled={item.completed}
                              className="gap-0 border rounded-lg overflow-hidden"
                            >
                              <ToggleGroupItem 
                                value="gokwik" 
                                aria-label="GoKwik"
                                className="text-xs px-2 py-1 h-7 rounded-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                <Building2 className="h-3 w-3 mr-1" />
                                GoKwik
                              </ToggleGroupItem>
                              <ToggleGroupItem 
                                value="neutral" 
                                aria-label="Neutral"
                                className="text-xs px-2 py-1 h-7 rounded-none border-x data-[state=on]:bg-muted data-[state=on]:text-muted-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </ToggleGroupItem>
                              <ToggleGroupItem 
                                value="merchant" 
                                aria-label="Merchant"
                                className="text-xs px-2 py-1 h-7 rounded-none data-[state=on]:bg-amber-500 data-[state=on]:text-white"
                              >
                                <Users className="h-3 w-3 mr-1" />
                                Merchant
                              </ToggleGroupItem>
                            </ToggleGroup>
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
