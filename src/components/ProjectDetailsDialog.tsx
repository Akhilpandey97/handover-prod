import { Project } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Globe,
  Link2,
  MapPin,
  TrendingUp,
  User,
} from "lucide-react";
import { format } from "date-fns";

interface ProjectDetailsDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectDetailsDialog = ({
  project,
  open,
  onOpenChange,
}: ProjectDetailsDialogProps) => {
  if (!project) return null;

  const DetailRow = ({ icon: Icon, label, value, isLink }: { icon: any; label: string; value?: string; isLink?: boolean }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLink && value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Open Link <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-sm font-medium truncate">{value || "Not specified"}</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>{project.merchantName}</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                MID: {project.mid}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Business Metrics */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Business Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">ARR</p>
                  <p className="text-lg font-bold">{project.arr} cr</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Txns/Day</p>
                  <p className="text-lg font-bold">{project.txnsPerDay}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">AOV</p>
                  <p className="text-lg font-bold">₹{project.aov.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Go Live %</p>
                  <p className="text-lg font-bold">{project.goLivePercent}%</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Project Info */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Project Information
              </h4>
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow icon={Globe} label="Platform" value={project.platform} />
                <DetailRow icon={Building2} label="Category" value={project.category} />
                <DetailRow icon={User} label="Sales SPOC" value={project.salesSpoc} />
                <DetailRow icon={TrendingUp} label="Integration Type" value={project.integrationType} />
                <DetailRow icon={Building2} label="PG Onboarding" value={project.pgOnboarding} />
                <DetailRow icon={User} label="Current Owner" value={teamLabels[project.currentOwnerTeam]} />
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Important Dates
              </h4>
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow
                  icon={Calendar}
                  label="Kick Off Date"
                  value={format(new Date(project.kickOffDate), "dd MMM yyyy")}
                />
                <DetailRow
                  icon={Calendar}
                  label="Go Live Date"
                  value={project.goLiveDate ? format(new Date(project.goLiveDate), "dd MMM yyyy") : "TBD"}
                />
              </div>
            </div>

            <Separator />

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Links
              </h4>
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow icon={Globe} label="Brand URL" value={project.brandUrl} isLink />
                <DetailRow icon={Link2} label="JIRA Link" value={project.jiraLink} isLink />
                <DetailRow icon={Link2} label="BRD Link" value={project.brdLink} isLink />
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Notes</h4>
              <div className="space-y-3">
                {project.mintNotes && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">MINT Notes</p>
                    <p className="text-sm">{project.mintNotes}</p>
                  </div>
                )}
                {project.projectNotes && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Project Notes</p>
                    <p className="text-sm">{project.projectNotes}</p>
                  </div>
                )}
                {project.phaseComment && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Phase Comment</p>
                    <p className="text-sm whitespace-pre-wrap">{project.phaseComment}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transfer History */}
            {project.transferHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">Transfer History</h4>
                  <div className="space-y-3">
                    {project.transferHistory.map((transfer, idx) => (
                      <div key={transfer.id} className="relative pl-6 pb-3 border-l-2 border-muted last:border-transparent">
                        <div className="absolute left-[-5px] top-0 h-2 w-2 rounded-full bg-primary" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {teamLabels[transfer.fromTeam]} → {teamLabels[transfer.toTeam]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Transferred by {transfer.transferredBy} on{" "}
                            {format(new Date(transfer.transferredAt), "dd MMM yyyy, HH:mm")}
                          </p>
                          {transfer.acceptedBy && (
                            <p className="text-xs text-green-600">
                              Accepted by {transfer.acceptedBy} on{" "}
                              {format(new Date(transfer.acceptedAt!), "dd MMM yyyy, HH:mm")}
                            </p>
                          )}
                          {transfer.notes && (
                            <p className="text-xs text-muted-foreground italic">"{transfer.notes}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
