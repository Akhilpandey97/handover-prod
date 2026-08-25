import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Circle, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PortalChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  phase: string;
  waitingOn: string | null;
}

interface PortalData {
  project: {
    merchantName: string;
    platform: string | null;
    phase: string;
    state: string | null;
    goLivePercent: number;
    kickOffDate: string;
    expectedGoLiveDate: string | null;
    goLiveDate: string | null;
    waitingOn: string | null;
    latestUpdate: string | null;
  };
  checklist: PortalChecklistItem[];
  brand: { name: string | null; logoUrl: string | null };
}

const phaseTitles: Record<string, string> = {
  mint: "Scoping",
  integration: "Integration",
  ms: "Merchant Success",
  completed: "Completed",
};

const MerchantPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/merchant-portal-data?token=${encodeURIComponent(token || "")}`,
        );
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error || "Unable to load this portal");
        } else {
          setData(payload);
        }
      } catch {
        setError("Unable to load this portal");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [token]);

  const grouped = useMemo(() => {
    const map = new Map<string, PortalChecklistItem[]>();
    (data?.checklist || []).forEach((item) => {
      const list = map.get(item.phase) || [];
      list.push(item);
      map.set(item.phase, list);
    });
    return Array.from(map.entries());
  }, [data]);

  useEffect(() => {
    if (data?.project.merchantName) {
      document.title = `${data.project.merchantName} — Onboarding Status`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Portal unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </Card>
      </main>
    );
  }

  const { project } = data;
  const completed = data.checklist.filter((item) => item.completed).length;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          {data.brand.logoUrl && (
            <img src={data.brand.logoUrl} alt={`${data.brand.name || "Workspace"} logo`} className="h-8 w-8 rounded" />
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {data.brand.name || "Onboarding"} · Live status
            </p>
            <h1 className="text-xl font-semibold">{project.merchantName}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{phaseTitles[project.phase] || project.phase}</Badge>
            {project.state && <Badge variant="outline" className="capitalize">{project.state.replace(/_/g, " ")}</Badge>}
            {project.waitingOn && (
              <Badge variant="outline" className="capitalize">Waiting on {project.waitingOn}</Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Go-live readiness</span>
              <span className="font-mono">{project.goLivePercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, project.goLivePercent))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {completed} of {data.checklist.length} steps complete
            </p>
          </div>

          <div className="grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Kick-off</p>
              <p className="font-medium">{project.kickOffDate || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expected go-live</p>
              <p className="font-medium">{project.expectedGoLiveDate || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual go-live</p>
              <p className="font-medium">{project.goLiveDate || "—"}</p>
            </div>
          </div>

          {project.latestUpdate && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest update</p>
              {project.latestUpdate}
            </div>
          )}
        </Card>

        {grouped.map(([phase, items]) => (
          <Card key={phase} className="p-5">
            <h2 className="mb-3 text-sm font-semibold">{phaseTitles[phase] || phase}</h2>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-sm">
                  {item.completed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : item.waitingOn === "merchant" ? (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(item.completed && "text-muted-foreground line-through")}>{item.title}</span>
                  {!item.completed && item.waitingOn === "merchant" && (
                    <Badge variant="outline" className="ml-auto text-[10px]">Action needed</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          This is a read-only status page shared with you by {data.brand.name || "your delivery team"}.
        </p>
      </div>
    </main>
  );
};

export default MerchantPortal;
