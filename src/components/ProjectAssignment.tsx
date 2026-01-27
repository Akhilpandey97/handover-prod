import { useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, FolderKanban } from "lucide-react";
import { teamLabels, TeamRole } from "@/data/teams";

export const ProjectAssignment = () => {
  const { projects } = useProjects();
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [targetTeam, setTargetTeam] = useState<TeamRole>("mint");
  const [isAssigning, setIsAssigning] = useState(false);

  // Get projects that can be assigned to MINT (unassigned or need reassignment)
  const assignableProjects = projects.filter(
    (p) => p.currentOwnerTeam === "mint" || !p.currentOwnerTeam
  );

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedProjects.size === assignableProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(assignableProjects.map((p) => p.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedProjects.size === 0) {
      toast.error("Please select at least one project");
      return;
    }

    setIsAssigning(true);
    try {
      const projectIds = Array.from(selectedProjects);

      // Update projects to assign to MINT team
      const { error } = await supabase
        .from("projects")
        .update({
          current_owner_team: targetTeam,
          pending_acceptance: true,
          updated_at: new Date().toISOString(),
        })
        .in("id", projectIds);

      if (error) throw error;

      // Refresh projects
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      
      toast.success(`Assigned ${selectedProjects.size} projects to ${teamLabels[targetTeam]}`);
      setSelectedProjects(new Set());
    } catch (error: any) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign projects: " + error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5" />
          Assign Projects to Team
        </CardTitle>
        <CardDescription>
          Select projects and assign them to the MINT team for processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target Team & Actions */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Assign to:</span>
            <Select value={targetTeam} onValueChange={(v) => setTargetTeam(v as TeamRole)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mint">MINT (Presales)</SelectItem>
                <SelectItem value="integration">Integration Team</SelectItem>
                <SelectItem value="ms">Merchant Success</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Button
            onClick={handleAssign}
            disabled={selectedProjects.size === 0 || isAssigning}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isAssigning ? "Assigning..." : `Assign ${selectedProjects.size} Selected`}
          </Button>
        </div>

        {/* Projects Table */}
        {assignableProjects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No projects available for assignment</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProjects.size === assignableProjects.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>MID</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Current Team</TableHead>
                  <TableHead>Phase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignableProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{project.merchantName}</TableCell>
                    <TableCell className="text-muted-foreground">{project.mid}</TableCell>
                    <TableCell>{project.platform || "-"}</TableCell>
                    <TableCell>
                      {project.currentOwnerTeam ? (
                        <Badge variant="outline">
                          {teamLabels[project.currentOwnerTeam]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{project.currentPhase || "mint"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
