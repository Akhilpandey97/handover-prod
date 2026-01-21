import { useState } from "react";
import { Project, getPhaseLabel } from "@/data/projects";
import { HandoffBadge } from "./HandoffBadge";
import { PhasePipeline } from "./PhasePipeline";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onAcceptKT?: (projectId: string) => void;
}

interface DetailSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function DetailSection({ icon, title, children }: DetailSectionProps) {
  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary">{icon}</span>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: string | number | null | undefined;
  isLink?: boolean;
  fullWidth?: boolean;
}

function DetailField({ label, value, isLink, fullWidth }: DetailFieldProps) {
  const displayValue = value ?? "—";

  return (
    <div className={cn("py-1", fullWidth && "col-span-2")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLink && value ? (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-sm font-medium text-foreground truncate">{displayValue}</p>
      )}
    </div>
  );
}

export function ProjectCard({ project, onAcceptKT }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPending = project.handoffStatus === "pending";

  return (
    <div
      className={cn(
        "bg-card border rounded-xl overflow-hidden transition-all duration-200",
        isPending && "border-pending/50 shadow-[0_0_0_1px_hsl(var(--pending)/0.1)]",
        isExpanded && "shadow-lg"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-5 cursor-pointer transition-colors hover:bg-muted/30",
          isPending && "bg-pending/5"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold truncate">{project.merchantName}</h3>
              <HandoffBadge status={project.handoffStatus} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {project.platform}
              </span>
              <span>{project.category}</span>
              <span className="font-mono text-xs">{project.mid}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPending && onAcceptKT && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcceptKT(project.id);
                }}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept KT
              </Button>
            )}
            <Button variant="ghost" size="icon" className="shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Go Live Progress</span>
              <span className="font-medium">{project.goLivePercent}%</span>
            </div>
            <Progress value={project.goLivePercent} className="h-1.5" />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">ARR</p>
            <p className="text-lg font-bold">{project.arr} cr</p>
          </div>
        </div>

        {/* Phase Pipeline - Always Visible */}
        <div className="mt-4 pt-4 border-t">
          <PhasePipeline currentPhase={project.projectPhase} />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t bg-muted/20 p-5 animate-fade-in">
          <DetailSection icon={<TrendingUp className="h-4 w-4" />} title="Business Metrics">
            <DetailField label="Txns/Day" value={project.txnsPerDay} />
            <DetailField label="AOV" value={`₹${project.aov?.toLocaleString()}`} />
            <DetailField label="Web Traffic" value={`${project.webPercent}%`} />
            <DetailField label="Mobile Traffic" value={project.mobilePercent ? `${project.mobilePercent}%` : null} />
            <DetailField label="Prepaid/COD" value={project.prepaidCodSplit} />
            <DetailField label="Age" value={`${project.ageDays} days`} />
          </DetailSection>

          <Separator className="my-2" />

          <DetailSection icon={<Users className="h-4 w-4" />} title="Team">
            <DetailField label="MINT" value={project.team.mint} />
            <DetailField label="Sales SPOC" value={project.team.salesSpoc} />
            <DetailField label="MS" value={project.team.ms} />
            <DetailField label="Phase Owner" value={project.phaseOwner} />
          </DetailSection>

          <Separator className="my-2" />

          <DetailSection icon={<Calendar className="h-4 w-4" />} title="Timeline">
            <DetailField label="Kick Off" value={project.kickOffDate} />
            <DetailField label="Go Live" value={project.goLiveDate || "TBD"} />
            <DetailField label="Integration Type" value={project.integrationType} />
            <DetailField label="PG Onboarding" value={project.pgOnboarding} />
          </DetailSection>

          <Separator className="my-2" />

          <DetailSection icon={<Link2 className="h-4 w-4" />} title="Links">
            <DetailField label="Brand Website" value={project.brandUrl} isLink />
            <DetailField label="JIRA" value={project.projectJira} isLink />
            <DetailField label="BRD" value={project.brdLink} isLink />
            <DetailField label="Go Live Checklist" value={project.goLiveChecklist} isLink />
          </DetailSection>

          <Separator className="my-2" />

          <DetailSection icon={<FileText className="h-4 w-4" />} title="Notes">
            <div className="col-span-2 space-y-3">
              {project.projectNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Project Notes</p>
                  <p className="text-sm bg-card p-3 rounded-lg border">{project.projectNotes}</p>
                </div>
              )}
              {project.phaseComment && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phase Comments</p>
                  <p className="text-sm bg-card p-3 rounded-lg border whitespace-pre-wrap">
                    {project.phaseComment}
                  </p>
                </div>
              )}
              {project.phase2Notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phase 2 Notes</p>
                  <p className="text-sm bg-card p-3 rounded-lg border whitespace-pre-wrap">
                    {project.phase2Notes}
                  </p>
                </div>
              )}
            </div>
          </DetailSection>

          <Separator className="my-2" />

          <DetailSection icon={<Clock className="h-4 w-4" />} title="Time Tracking">
            <div className="col-span-2 flex gap-4">
              <div className="flex-1 p-3 bg-card rounded-lg border text-center">
                <p className="text-xs text-muted-foreground">Gokwik</p>
                <p className="text-xl font-bold text-primary">{project.gokwikTime}</p>
              </div>
              <div className="flex-1 p-3 bg-card rounded-lg border text-center">
                <p className="text-xs text-muted-foreground">Merchant</p>
                <p className="text-xl font-bold text-foreground">{project.merchantTime}</p>
              </div>
            </div>
          </DetailSection>
        </div>
      )}
    </div>
  );
}
