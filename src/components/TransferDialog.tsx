import { useState } from "react";
import { Project } from "@/data/projectsData";
import { teamUsers, teamLabels, teamColors, TeamRole } from "@/data/teams";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, User } from "lucide-react";

interface TransferDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (assigneeId: string, assigneeName: string, notes: string) => void;
}

const getNextTeam = (current: TeamRole): TeamRole | null => {
  if (current === "mint") return "integration";
  if (current === "integration") return "ms";
  return null;
};

export const TransferDialog = ({
  project,
  open,
  onOpenChange,
  onTransfer,
}: TransferDialogProps) => {
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [notes, setNotes] = useState("");

  const nextTeam = getNextTeam(project.currentOwnerTeam as TeamRole);
  const nextTeamMembers = teamUsers.filter((u) => u.team === nextTeam);

  const handleTransfer = () => {
    if (!selectedAssignee) return;
    const assignee = nextTeamMembers.find((u) => u.id === selectedAssignee);
    if (assignee) {
      onTransfer(assignee.id, assignee.name, notes);
      setSelectedAssignee("");
      setNotes("");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedAssignee("");
    setNotes("");
    onOpenChange(false);
  };

  if (!nextTeam) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Transfer Project
          </DialogTitle>
          <DialogDescription>
            Transfer <strong>{project.merchantName}</strong> to{" "}
            <strong>{teamLabels[nextTeam]}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Select Owner from {teamLabels[nextTeam]}</Label>
            <RadioGroup
              value={selectedAssignee}
              onValueChange={setSelectedAssignee}
              className="space-y-2"
            >
              {nextTeamMembers.map((member) => (
                <label
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAssignee === member.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value={member.id} id={member.id} />
                  <div
                    className={`h-9 w-9 rounded-full ${teamColors[member.team]} flex items-center justify-center text-white font-semibold text-sm`}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Transfer Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes for the receiving team..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedAssignee}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Transfer to {teamLabels[nextTeam]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
