import { Project } from "@/data/projectsData";

export interface HealthScore {
  score: number; // 0-100
  label: "Healthy" | "At Risk" | "Critical" | "Stale";
  color: string;
  factors: string[];
}

/**
 * Compute a deterministic health score for a project based on heuristics.
 * No AI call needed — runs instantly on the client.
 */
export const computeHealthScore = (project: Project): HealthScore => {
  let score = 100;
  const factors: string[] = [];

  // 1. No owner assigned → -25
  if (!project.assignedOwner) {
    score -= 25;
    factors.push("No owner assigned");
  }

  // 2. Checklist progress vs age
  const totalItems = project.checklist.length;
  const completedItems = project.checklist.filter(c => c.completed).length;
  const completionPct = totalItems > 0 ? completedItems / totalItems : 0;

  if (totalItems > 0 && completionPct < 0.2) {
    score -= 15;
    factors.push("Low checklist completion");
  }

  // 3. Days since kick-off with low progress
  const kickOff = project.dates.kickOffDate ? new Date(project.dates.kickOffDate) : null;
  if (kickOff) {
    const daysSinceKickOff = Math.floor((Date.now() - kickOff.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceKickOff > 30 && completionPct < 0.3) {
      score -= 15;
      factors.push(`${daysSinceKickOff}d since kick-off, only ${Math.round(completionPct * 100)}% done`);
    }
    if (daysSinceKickOff > 60 && completionPct < 0.5) {
      score -= 10;
      factors.push("Significantly behind schedule");
    }
  }

  // 4. Blocked or on-hold state
  if (project.projectState === "blocked") {
    score -= 20;
    factors.push("Project is blocked");
  } else if (project.projectState === "on_hold") {
    score -= 10;
    factors.push("Project is on hold");
  } else if (project.projectState === "not_started") {
    score -= 5;
    factors.push("Not yet started");
  }

  // 5. Go-live date passed without completion
  const expectedGoLive = project.dates.expectedGoLiveDate ? new Date(project.dates.expectedGoLiveDate) : null;
  if (expectedGoLive && expectedGoLive < new Date() && project.projectState !== "live") {
    score -= 20;
    factors.push("Past expected go-live date");
  }

  // 6. High ARR but low progress
  if (project.arr >= 5 && completionPct < 0.3) {
    score -= 10;
    factors.push("High-value project with low progress");
  }

  score = Math.max(0, Math.min(100, score));

  let label: HealthScore["label"];
  let color: string;
  if (score >= 75) {
    label = "Healthy";
    color = "hsl(142 71% 45%)";
  } else if (score >= 50) {
    label = "At Risk";
    color = "hsl(38 92% 50%)";
  } else if (score >= 25) {
    label = "Critical";
    color = "hsl(0 84% 60%)";
  } else {
    label = "Stale";
    color = "hsl(0 0% 50%)";
  }

  return { score, label, color, factors };
};
