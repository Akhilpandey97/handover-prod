import { Project } from "@/data/projects";
import { StatusBadge } from "./StatusBadge";
import { PhaseBadge } from "./PhaseBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, ExternalLink, Tag, BarChart3, Users, Rocket, Calendar, Link2, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ProjectDetailPanelProps {
  project: Project;
  onClose: () => void;
}

interface FieldRowProps {
  label: string;
  value: string | number | null | undefined;
  description?: string;
  isLink?: boolean;
}

function FieldRow({ label, value, description, isLink }: FieldRowProps) {
  const displayValue = value ?? "—";
  
  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {isLink && value ? (
          <a
            href={value as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            Open link
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground text-right shrink-0 max-w-[200px] truncate">
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-0 divide-y divide-border">{children}</div>
    </div>
  );
}

export function ProjectDetailPanel({ project, onClose }: ProjectDetailPanelProps) {
  return (
    <div className="w-[480px] border-l bg-card h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{project.merchantName}</h2>
            <p className="text-sm text-muted-foreground font-mono mt-1">{project.mid}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 -mt-1 -mr-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <StatusBadge status={project.projectState} />
          <PhaseBadge phase={project.projectPhase} />
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Go Live Progress</span>
            <span className="font-medium">{project.goLivePercent}%</span>
          </div>
          <Progress value={project.goLivePercent} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-6 scrollbar-thin">
        <Section icon={<Tag className="h-4 w-4" />} title="System">
          <FieldRow label="Merchant Name" value={project.merchantName} description="Merchant business name" />
          <FieldRow label="MID" value={project.mid} description="Auto-generated from website" />
          <FieldRow label="UIF" value={project.uif} description="Unique identifier" />
        </Section>

        <Separator />

        <Section icon={<BarChart3 className="h-4 w-4" />} title="Business">
          <FieldRow label="ARR (cr)" value={project.arr} description="Annual recurring revenue" />
          <FieldRow label="Txns/Day" value={project.txnsPerDay} description="Average transactions per day" />
          <FieldRow label="AOV" value={project.aov?.toLocaleString()} description="Average order value" />
          <FieldRow label="Web %" value={project.webPercent} description="Web traffic percentage" />
          <FieldRow label="Mobile %" value={project.mobilePercent} description="Mobile traffic percentage" />
          <FieldRow label="Prepaid/COD Split" value={project.prepaidCodSplit} description="Payment method split" />
        </Section>

        <Separator />

        <Section icon={<Users className="h-4 w-4" />} title="Team">
          <FieldRow label="MINT" value={project.mintSpoc} description="MINT team member" />
          <FieldRow label="Sales SPOC" value={project.salesSpoc} description="Sales single point of contact" />
          <FieldRow label="MS" value={project.msSpoc} description="MS team member" />
          <FieldRow label="Sales" value={project.sales} description="Sales team member" />
        </Section>

        <Separator />

        <Section icon={<Rocket className="h-4 w-4" />} title="Project">
          <FieldRow label="Platform" value={project.platform} description="E-commerce platform" />
          <FieldRow label="Category" value={project.category} description="Business category" />
          <FieldRow label="Mobile Platform" value={project.mobilePlatform} description="Mobile platform type" />
          <FieldRow label="Mobile Category" value={project.mobileCategory} description="Mobile app category" />
          <FieldRow label="Project State" value={project.projectState} description="Current project state" />
          <FieldRow label="Project Phase" value={project.projectPhase} description="Current project phase" />
          <FieldRow label="Phase Owner" value={project.phaseOwner} description="Owner of current phase" />
          <FieldRow label="Integration Type" value={project.integrationType} description="Type of integration" />
          <FieldRow label="Customisations" value={project.customisations} description="Custom requirements" />
          <FieldRow label="PG Onboarding" value={project.pgOnboarding} description="Payment gateway onboarding" />
          <FieldRow label="Phase 2 Needed" value={project.phase2Needed} description="Phase 2 requirements" />
        </Section>

        <Separator />

        <Section icon={<Calendar className="h-4 w-4" />} title="Dates">
          <FieldRow label="Kick Off Date" value={project.kickOffDate} description="Project kickoff date" />
          <FieldRow label="Go Live Date" value={project.goLiveDate || "dd/mm/yyyy"} description="Go live date" />
          <FieldRow label="Age (days)" value={project.ageDays} description="Project age in days" />
          <FieldRow label="Go Live %" value={`${project.goLivePercent}%`} description="Go live percentage" />
        </Section>

        <Separator />

        <Section icon={<Link2 className="h-4 w-4" />} title="Links">
          <FieldRow label="Brand URL" value={project.brandUrl} isLink description="Merchant website URL" />
          <FieldRow label="Project JIRA" value={project.projectJira} isLink description="JIRA project link" />
          <FieldRow label="API QC Checklist" value={project.apiQcChecklist} isLink description="API QC checklist link" />
          <FieldRow label="BRD Link" value={project.brdLink} isLink description="BRD document link" />
          <FieldRow label="Go Live Checklist" value={project.goLiveChecklist} isLink description="Go live checklist link" />
        </Section>

        <Separator />

        <Section icon={<FileText className="h-4 w-4" />} title="Notes">
          <div className="py-2.5">
            <span className="text-sm font-medium">MINT Notes</span>
            <p className="text-xs text-muted-foreground mt-0.5">MINT team notes</p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {project.mintNotes || "—"}
            </p>
          </div>
          <div className="py-2.5">
            <span className="text-sm font-medium">Project Notes</span>
            <p className="text-xs text-muted-foreground mt-0.5">General project notes</p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {project.projectNotes || "—"}
            </p>
          </div>
          <div className="py-2.5">
            <span className="text-sm font-medium">Phase Comment</span>
            <p className="text-xs text-muted-foreground mt-0.5">Phase specific comments</p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {project.phaseComment || "—"}
            </p>
          </div>
          <div className="py-2.5">
            <span className="text-sm font-medium">Ops Comments</span>
            <p className="text-xs text-muted-foreground mt-0.5">Operations comments</p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {project.opsComments || "—"}
            </p>
          </div>
          <div className="py-2.5">
            <span className="text-sm font-medium">Phase 2 Notes</span>
            <p className="text-xs text-muted-foreground mt-0.5">Phase 2 notes</p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {project.phase2Notes || "—"}
            </p>
          </div>
        </Section>

        <Separator />

        <Section icon={<Clock className="h-4 w-4" />} title="Phase Tracking">
          <div className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Time Tracking</span>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Gokwik</p>
                <p className="text-lg font-semibold mt-1">G: {project.gokwikTime}</p>
              </div>
              <div className="text-muted-foreground">|</div>
              <div className="flex-1 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Merchant</p>
                <p className="text-lg font-semibold mt-1">M: {project.merchantTime}</p>
              </div>
            </div>
          </div>
        </Section>

        <div className="h-6" />
      </ScrollArea>
    </div>
  );
}
