import { Project } from "@/data/projects";
import { StatusBadge } from "./StatusBadge";
import { PhaseBadge } from "./PhaseBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

interface ProjectTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  selectedProjectId: string | null;
}

export function ProjectTable({ projects, onSelectProject, selectedProjectId }: ProjectTableProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Merchant</TableHead>
            <TableHead className="font-semibold">MID</TableHead>
            <TableHead className="font-semibold">Platform</TableHead>
            <TableHead className="font-semibold">Kick Off</TableHead>
            <TableHead className="font-semibold">Go Live</TableHead>
            <TableHead className="font-semibold">Phase</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">ARR (cr)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow
              key={project.id}
              onClick={() => onSelectProject(project)}
              className={`cursor-pointer transition-colors ${
                selectedProjectId === project.id
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-muted/50"
              }`}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {project.merchantName}
                  {project.brandUrl && (
                    <a
                      href={project.brandUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {project.mid}
              </TableCell>
              <TableCell>{project.platform}</TableCell>
              <TableCell className="text-muted-foreground">
                {project.kickOffDate || "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {project.goLiveDate || "dd/mm/yyyy"}
              </TableCell>
              <TableCell>
                <PhaseBadge phase={project.projectPhase} />
              </TableCell>
              <TableCell>
                <StatusBadge status={project.projectState} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {project.arr.toFixed(3)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
