import { useMemo, useState } from "react";
import { Project, calculateTimeFromChecklist, formatDuration, projectStateLabels } from "@/data/projectsData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertCircle, Trophy, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projects: Project[];
}

export const TacticalLists = ({ projects }: Props) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("atrisk");

  // At Risk Watchlist
  const atRiskProjects = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return projects
      .filter(p => p.projectState !== "live" && p.currentPhase !== "completed" && p.dates.expectedGoLiveDate && p.dates.expectedGoLiveDate < today)
      .map(p => {
        const daysOverdue = Math.floor((Date.now() - new Date(p.dates.expectedGoLiveDate!).getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysOverdue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [projects]);

  // Task Completion Leaderboard
  const leaderboard = useMemo(() => {
    return projects
      .filter(p => p.projectState !== "live" && p.currentPhase !== "completed")
      .map(p => {
        const mintTasks = p.checklist.filter(c => c.ownerTeam === "mint");
        const intTasks = p.checklist.filter(c => c.ownerTeam === "integration");
        const mintDone = mintTasks.filter(c => c.completed).length;
        const intDone = intTasks.filter(c => c.completed).length;
        const totalDone = p.checklist.filter(c => c.completed).length;
        const total = p.checklist.length;
        const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0;

        return {
          id: p.id,
          name: p.merchantName,
          phase: p.currentPhase,
          state: p.projectState,
          mintProgress: mintTasks.length > 0 ? `${mintDone}/${mintTasks.length}` : "—",
          intProgress: intTasks.length > 0 ? `${intDone}/${intTasks.length}` : "—",
          overallProgress: `${totalDone}/${total}`,
          pct,
          owner: p.assignedOwnerName || "Unassigned",
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [projects]);

  const fetchAiInsight = async () => {
    setAiLoading(true);
    try {
      const { data } = await supabase.functions.invoke("ai-project-insights", {
        body: {
          type: "insights",
          project: {
            merchantName: "Tactical Summary",
            mid: "TAC",
            currentPhase: "overview",
            projectState: `${atRiskProjects.length} at-risk, ${leaderboard.length} active`,
            arr: 0,
            platform: "All",
            dates: { kickOffDate: "N/A" },
            currentOwnerTeam: "All",
            currentResponsibility: "N/A",
            checklist: [],
            transferHistory: [],
          },
        },
      });
      setAiInsight(data?.result || "Unable to generate insights.");
    } catch {
      setAiInsight("Failed to generate AI insights.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Tactical Insights
            </CardTitle>
            <Button size="sm" variant="outline" onClick={fetchAiInsight} disabled={aiLoading} className="gap-2">
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {aiInsight ? "Refresh" : "Generate"}
            </Button>
          </div>
        </CardHeader>
        {aiInsight && (
          <CardContent className="pt-0">
            <div className="text-sm space-y-1 whitespace-pre-line">{aiInsight}</div>
          </CardContent>
        )}
      </Card>

      {/* At Risk Watchlist */}
      <Collapsible open={expandedSection === "atrisk"} onOpenChange={() => setExpandedSection(expandedSection === "atrisk" ? null : "atrisk")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  "At Risk" Watchlist
                  {atRiskProjects.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{atRiskProjects.length} overdue</Badge>
                  )}
                </CardTitle>
                {expandedSection === "atrisk" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
              <CardDescription>Projects where Expected Go-Live has passed but are not yet Live — immediate escalation list</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {atRiskProjects.length === 0 ? (
                <div className="text-center py-6">
                  <Badge className="bg-emerald-500/10 text-emerald-600 text-sm px-4 py-2">
                    ✅ No at-risk projects — all on track!
                  </Badge>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Expected Go-Live</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>ARR (Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atRiskProjects.map(p => (
                      <TableRow key={p.id} className="bg-red-50/50 dark:bg-red-950/10">
                        <TableCell className="font-medium">{p.merchantName}</TableCell>
                        <TableCell>{p.dates.expectedGoLiveDate}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{p.daysOverdue}d overdue</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{p.currentPhase}</TableCell>
                        <TableCell>{projectStateLabels[p.projectState]}</TableCell>
                        <TableCell>{p.assignedOwnerName || "Unassigned"}</TableCell>
                        <TableCell>{p.arr}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Task Completion Leaderboard */}
      <Collapsible open={expandedSection === "leaderboard"} onOpenChange={() => setExpandedSection(expandedSection === "leaderboard" ? null : "leaderboard")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Task Completion Leaderboard
                </CardTitle>
                {expandedSection === "leaderboard" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
              <CardDescription>MINT & Integration task completion — how close each project is to the next phase</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>MINT Tasks</TableHead>
                    <TableHead>Integration Tasks</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.owner}</TableCell>
                      <TableCell className="capitalize">{p.phase}</TableCell>
                      <TableCell>{p.mintProgress}</TableCell>
                      <TableCell>{p.intProgress}</TableCell>
                      <TableCell>{p.overallProgress}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.pct} className="h-2 w-20" />
                          <span className="text-xs font-medium">{p.pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
