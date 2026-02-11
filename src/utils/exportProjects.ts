import { Project } from "@/data/projectsData";
import { teamLabels } from "@/data/teams";
import { projectStateLabels } from "@/data/projectsData";

const escapeCSV = (value: string | number | undefined | null): string => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportProjectsToCSV = (projects: Project[]) => {
  const headers = [
    "Merchant Name",
    "MID",
    "Platform",
    "Category",
    "ARR",
    "Txns/Day",
    "AOV",
    "Current Phase",
    "Current Team",
    "Assigned Owner",
    "Project State",
    "Pending Acceptance",
    "Go-Live %",
    "Start Date (Kick Off)",
    "Expected Go-Live Date",
    "Go-Live Date",
    "Sales SPOC",
    "Integration Type",
    "PG Onboarding",
    "Responsibility",
    "Brand URL",
    "JIRA Link",
    "BRD Link",
    "MINT Notes",
    "Project Notes",
    "Phase Comment",
    "Checklist Total",
    "Checklist Completed",
    "Transfer Count",
  ];

  const rows = projects.map((p) => {
    const completedChecklist = p.checklist.filter((c) => c.completed).length;
    return [
      p.merchantName,
      p.mid,
      p.platform,
      p.category,
      p.arr,
      p.txnsPerDay,
      p.aov,
      p.currentPhase,
      teamLabels[p.currentOwnerTeam] || p.currentOwnerTeam,
      p.assignedOwnerName || "",
      projectStateLabels[p.projectState] || p.projectState,
      p.pendingAcceptance ? "Yes" : "No",
      p.goLivePercent,
      p.dates.kickOffDate,
      p.dates.expectedGoLiveDate || "",
      p.dates.goLiveDate || "",
      p.salesSpoc,
      p.integrationType,
      p.pgOnboarding,
      p.currentResponsibility,
      p.links.brandUrl,
      p.links.jiraLink || "",
      p.links.brdLink || "",
      p.notes.mintNotes || "",
      p.notes.projectNotes || "",
      p.notes.currentPhaseComment || "",
      p.checklist.length,
      completedChecklist,
      p.transferHistory.length,
    ].map(escapeCSV);
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `projects-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
