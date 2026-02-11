import { Project, calculateTimeByParty, formatDuration } from "@/data/projectsData";
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
  // Collect all unique checklist titles across projects (for column headers)
  const allChecklistTitles: string[] = [];
  const titleSet = new Set<string>();
  projects.forEach((p) => {
    p.checklist.forEach((item) => {
      const key = `${item.phase}|${item.title}`;
      if (!titleSet.has(key)) {
        titleSet.add(key);
        allChecklistTitles.push(key);
      }
    });
  });

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
    // Project-level time tracking
    "Project GoKwik Time",
    "Project Merchant Time",
    // Team-wise checklist progress
    "MINT Tasks Completed",
    "MINT Tasks Total",
    "MINT GoKwik Time",
    "MINT Merchant Time",
    "Integration Tasks Completed",
    "Integration Tasks Total",
    "Integration GoKwik Time",
    "Integration Merchant Time",
    // Per-checklist item columns
    ...allChecklistTitles.flatMap((key) => {
      const [, title] = key.split("|");
      return [
        `${title} - Status`,
        `${title} - Responsibility`,
        `${title} - GoKwik Time`,
        `${title} - Merchant Time`,
      ];
    }),
  ];

  const rows = projects.map((p) => {
    const completedChecklist = p.checklist.filter((c) => c.completed).length;
    const projectTime = calculateTimeByParty(p.responsibilityLog);

    // Team-wise stats
    const mintItems = p.checklist.filter((c) => c.ownerTeam === "mint");
    const intItems = p.checklist.filter((c) => c.ownerTeam === "integration");

    const mintCompleted = mintItems.filter((c) => c.completed).length;
    const intCompleted = intItems.filter((c) => c.completed).length;

    let mintGokwik = 0, mintMerchant = 0;
    mintItems.forEach((item) => {
      const t = calculateTimeByParty(item.responsibilityLog);
      mintGokwik += t.gokwik;
      mintMerchant += t.merchant;
    });

    let intGokwik = 0, intMerchant = 0;
    intItems.forEach((item) => {
      const t = calculateTimeByParty(item.responsibilityLog);
      intGokwik += t.gokwik;
      intMerchant += t.merchant;
    });

    // Per-checklist item data
    const checklistMap = new Map<string, typeof p.checklist[0]>();
    p.checklist.forEach((item) => {
      checklistMap.set(`${item.phase}|${item.title}`, item);
    });

    const checklistColumns = allChecklistTitles.flatMap((key) => {
      const item = checklistMap.get(key);
      if (!item) return ["", "", "", ""];
      const time = calculateTimeByParty(item.responsibilityLog);
      return [
        item.completed ? "Done" : "Pending",
        item.currentResponsibility,
        formatDuration(time.gokwik),
        formatDuration(time.merchant),
      ];
    });

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
      formatDuration(projectTime.gokwik),
      formatDuration(projectTime.merchant),
      mintCompleted,
      mintItems.length,
      formatDuration(mintGokwik),
      formatDuration(mintMerchant),
      intCompleted,
      intItems.length,
      formatDuration(intGokwik),
      formatDuration(intMerchant),
      ...checklistColumns,
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
