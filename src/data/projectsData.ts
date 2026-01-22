import { TeamRole } from "./teams";

export type ProjectPhase = "mint" | "integration" | "ms" | "completed";
export type ResponsibilityParty = "gokwik" | "merchant";

export interface TransferRecord {
  id: string;
  fromTeam: TeamRole;
  toTeam: TeamRole;
  transferredBy: string;
  acceptedBy?: string;
  transferredAt: string;
  acceptedAt?: string;
  notes?: string;
}

export interface ResponsibilityLog {
  id: string;
  party: ResponsibilityParty;
  startedAt: string;
  endedAt?: string;
  phase: ProjectPhase;
}

export interface ChecklistResponsibilityLog {
  id: string;
  party: ResponsibilityParty;
  startedAt: string;
  endedAt?: string;
}

export interface ProjectChecklist {
  id: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  phase: ProjectPhase;
  ownerTeam: TeamRole; // Which team can complete this item
  currentResponsibility: ResponsibilityParty;
  responsibilityLog: ChecklistResponsibilityLog[];
}

export interface ProjectLinks {
  brandUrl: string;
  jiraLink?: string;
  brdLink?: string;
  mintChecklistLink?: string;
  integrationChecklistLink?: string;
}

export interface ProjectDates {
  kickOffDate: string;
  goLiveDate?: string;
  expectedGoLiveDate?: string;
}

export interface ProjectNotes {
  mintNotes?: string;
  projectNotes?: string;
  currentPhaseComment?: string;
  phase2Comment?: string;
}

export interface Project {
  id: string;
  merchantName: string;
  mid: string;
  platform: string;
  arr: number;
  txnsPerDay: number;
  aov: number;
  category: string;
  currentPhase: ProjectPhase;
  currentOwnerTeam: TeamRole;
  pendingAcceptance: boolean;
  goLivePercent: number;
  links: ProjectLinks;
  dates: ProjectDates;
  notes: ProjectNotes;
  transferHistory: TransferRecord[];
  checklist: ProjectChecklist[];
  salesSpoc: string;
  integrationType: string;
  pgOnboarding: string;
  currentResponsibility: ResponsibilityParty;
  responsibilityLog: ResponsibilityLog[];
}

// Helper to calculate time spent by each party
export const calculateTimeByParty = (logs: ResponsibilityLog[] | ChecklistResponsibilityLog[]): { gokwik: number; merchant: number } => {
  const result = { gokwik: 0, merchant: 0 };
  
  logs.forEach(log => {
    const start = new Date(log.startedAt).getTime();
    const end = log.endedAt ? new Date(log.endedAt).getTime() : Date.now();
    const duration = end - start;
    result[log.party] += duration;
  });
  
  return result;
};

export const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${hours}h`;
};

// MINT Checklist Items
const mintChecklistItems = [
  "Requirement gathering",
  "Feasibility Analysis",
  "BRD Details",
  "Technical Scoping",
  "Technical Walkthrough",
  "API Validation",
  "LCNC Config",
  "Create JIRA",
  "Transfer to Integration",
];

// Integration Checklist Items
const integrationChecklistItems = [
  "BRD Validation",
  "Integration Checklist",
  "Sandbox Testing",
  "Production Testing",
  "Dashboard Walkthrough with MS",
  "Go-Live",
];

export const createDefaultChecklist = (): ProjectChecklist[] => {
  const now = new Date().toISOString();
  const checklist: ProjectChecklist[] = [];

  mintChecklistItems.forEach((title, idx) => {
    checklist.push({
      id: `c-mint-${Date.now()}-${idx}`,
      title,
      completed: false,
      phase: "mint",
      ownerTeam: "mint",
      currentResponsibility: "gokwik",
      responsibilityLog: [
        {
          id: `cl-${Date.now()}-${idx}`,
          party: "gokwik",
          startedAt: now,
        },
      ],
    });
  });

  integrationChecklistItems.forEach((title, idx) => {
    checklist.push({
      id: `c-int-${Date.now()}-${idx}`,
      title,
      completed: false,
      phase: "integration",
      ownerTeam: "integration",
      currentResponsibility: "gokwik",
      responsibilityLog: [
        {
          id: `cl-${Date.now()}-${idx}`,
          party: "gokwik",
          startedAt: now,
        },
      ],
    });
  });

  return checklist;
};

export const createDefaultProject = (overrides?: Partial<Project>): Project => ({
  id: `proj-${Date.now()}`,
  merchantName: "",
  mid: "",
  platform: "Custom",
  arr: 0,
  txnsPerDay: 0,
  aov: 0,
  category: "",
  currentPhase: "mint",
  currentOwnerTeam: "mint",
  pendingAcceptance: false,
  goLivePercent: 0,
  links: {
    brandUrl: "",
    jiraLink: "",
    brdLink: "",
    mintChecklistLink: "",
    integrationChecklistLink: "",
  },
  dates: {
    kickOffDate: new Date().toISOString().split("T")[0],
    goLiveDate: undefined,
    expectedGoLiveDate: undefined,
  },
  notes: {
    mintNotes: "",
    projectNotes: "",
    currentPhaseComment: "",
    phase2Comment: "",
  },
  transferHistory: [],
  checklist: createDefaultChecklist(),
  salesSpoc: "",
  integrationType: "Standard",
  pgOnboarding: "",
  currentResponsibility: "gokwik",
  responsibilityLog: [
    {
      id: `r-${Date.now()}`,
      party: "gokwik",
      startedAt: new Date().toISOString(),
      phase: "mint",
    },
  ],
  ...overrides,
});

// Helper to create checklist for existing projects
const createChecklistForProject = (projectId: string, completedItems: { title: string; phase: ProjectPhase }[]): ProjectChecklist[] => {
  const now = new Date().toISOString();
  const checklist: ProjectChecklist[] = [];

  mintChecklistItems.forEach((title, idx) => {
    const isCompleted = completedItems.some(item => item.title === title);
    checklist.push({
      id: `${projectId}-c-mint-${idx}`,
      title,
      completed: isCompleted,
      completedAt: isCompleted ? now : undefined,
      phase: "mint",
      ownerTeam: "mint",
      currentResponsibility: "gokwik",
      responsibilityLog: [
        {
          id: `${projectId}-cl-mint-${idx}`,
          party: "gokwik",
          startedAt: now,
        },
      ],
    });
  });

  integrationChecklistItems.forEach((title, idx) => {
    const isCompleted = completedItems.some(item => item.title === title);
    checklist.push({
      id: `${projectId}-c-int-${idx}`,
      title,
      completed: isCompleted,
      completedAt: isCompleted ? now : undefined,
      phase: "integration",
      ownerTeam: "integration",
      currentResponsibility: "gokwik",
      responsibilityLog: [
        {
          id: `${projectId}-cl-int-${idx}`,
          party: "gokwik",
          startedAt: now,
        },
      ],
    });
  });

  return checklist;
};

export const initialProjects: Project[] = [
  {
    id: "proj-1",
    merchantName: "Ethera Diamonds",
    mid: "19tpy3qnz5dq",
    platform: "Custom",
    arr: 8.135,
    txnsPerDay: 8,
    aov: 50000,
    category: "Gems & Jewellery",
    currentPhase: "mint",
    currentOwnerTeam: "mint",
    pendingAcceptance: false,
    goLivePercent: 45,
    links: {
      brandUrl: "https://www.etheradiamonds.com/",
      jiraLink: "https://gokwik.atlassian.net/browse/CUST-262",
      brdLink: "https://docs.google.com/spreadsheets/d/example",
      mintChecklistLink: "https://docs.google.com/document/d/mint-checklist",
      integrationChecklistLink: "https://docs.google.com/document/d/int-checklist",
    },
    dates: {
      kickOffDate: "2025-01-13",
      goLiveDate: undefined,
      expectedGoLiveDate: "2025-02-15",
    },
    notes: {
      mintNotes: "High priority client, CEO directly involved",
      projectNotes: "Checkout lite, PAN card implementation and KP Integration",
      currentPhaseComment: "Initial scoping and API walkthrough is done. Awaiting update on API dev.",
      phase2Comment: "",
    },
    salesSpoc: "Saurabh",
    integrationType: "Advanced",
    pgOnboarding: "Easebuzz",
    transferHistory: [],
    checklist: createChecklistForProject("proj-1", [
      { title: "Requirement gathering", phase: "mint" },
      { title: "Feasibility Analysis", phase: "mint" },
    ]),
    currentResponsibility: "merchant",
    responsibilityLog: [
      { id: "r1", party: "gokwik", startedAt: "2025-01-13T09:00:00Z", endedAt: "2025-01-15T14:00:00Z", phase: "mint" },
      { id: "r2", party: "merchant", startedAt: "2025-01-15T14:00:00Z", phase: "mint" },
    ],
  },
  {
    id: "proj-2",
    merchantName: "Livspace",
    mid: "19u5u9kt1urj",
    platform: "Custom",
    arr: 0.1,
    txnsPerDay: 15,
    aov: 25000,
    category: "Home Decor",
    currentPhase: "integration",
    currentOwnerTeam: "integration",
    pendingAcceptance: true,
    goLivePercent: 60,
    links: {
      brandUrl: "https://www.livspace.com/",
      jiraLink: "https://gokwik.atlassian.net/browse/CUST-301",
      brdLink: "",
      mintChecklistLink: "https://docs.google.com/document/d/mint-checklist-2",
      integrationChecklistLink: "https://docs.google.com/document/d/int-checklist-2",
    },
    dates: {
      kickOffDate: "2025-01-14",
      goLiveDate: undefined,
      expectedGoLiveDate: "2025-02-28",
    },
    notes: {
      mintNotes: "Fast-track requested by sales",
      projectNotes: "Standard checkout integration",
      currentPhaseComment: "API development in progress",
      phase2Comment: "Need to coordinate with merchant tech team",
    },
    salesSpoc: "Amit",
    integrationType: "Standard",
    pgOnboarding: "Razorpay",
    transferHistory: [
      {
        id: "t1",
        fromTeam: "mint",
        toTeam: "integration",
        transferredBy: "Priya Sharma",
        transferredAt: "2025-01-16T10:30:00Z",
        notes: "All documentation complete, ready for integration",
      },
    ],
    checklist: createChecklistForProject("proj-2", [
      { title: "Requirement gathering", phase: "mint" },
      { title: "Feasibility Analysis", phase: "mint" },
      { title: "BRD Details", phase: "mint" },
      { title: "Technical Scoping", phase: "mint" },
      { title: "Technical Walkthrough", phase: "mint" },
      { title: "API Validation", phase: "mint" },
      { title: "LCNC Config", phase: "mint" },
      { title: "Create JIRA", phase: "mint" },
      { title: "Transfer to Integration", phase: "mint" },
    ]),
    currentResponsibility: "gokwik",
    responsibilityLog: [
      { id: "r1", party: "gokwik", startedAt: "2025-01-14T09:00:00Z", endedAt: "2025-01-15T16:00:00Z", phase: "mint" },
      { id: "r2", party: "merchant", startedAt: "2025-01-15T16:00:00Z", endedAt: "2025-01-16T10:30:00Z", phase: "mint" },
      { id: "r3", party: "gokwik", startedAt: "2025-01-16T10:30:00Z", phase: "integration" },
    ],
  },
  {
    id: "proj-3",
    merchantName: "Urban Company",
    mid: "19abc123xyz",
    platform: "Shopify",
    arr: 12.5,
    txnsPerDay: 120,
    aov: 1500,
    category: "Services",
    currentPhase: "ms",
    currentOwnerTeam: "ms",
    pendingAcceptance: true,
    goLivePercent: 85,
    links: {
      brandUrl: "https://www.urbancompany.com/",
      jiraLink: "https://gokwik.atlassian.net/browse/CUST-198",
      brdLink: "",
      mintChecklistLink: "https://docs.google.com/document/d/mint-checklist-3",
      integrationChecklistLink: "https://docs.google.com/document/d/int-checklist-3",
    },
    dates: {
      kickOffDate: "2024-12-01",
      goLiveDate: "2025-01-20",
      expectedGoLiveDate: "2025-01-20",
    },
    notes: {
      mintNotes: "Enterprise client",
      projectNotes: "Full checkout suite with loyalty integration",
      currentPhaseComment: "Final testing before go-live",
      phase2Comment: "Merchant team validated all test cases",
    },
    salesSpoc: "Neha",
    integrationType: "Enterprise",
    pgOnboarding: "PayU",
    transferHistory: [
      {
        id: "t1",
        fromTeam: "mint",
        toTeam: "integration",
        transferredBy: "Priya Sharma",
        acceptedBy: "Rahul Verma",
        transferredAt: "2024-12-10T09:00:00Z",
        acceptedAt: "2024-12-10T11:00:00Z",
        notes: "All documentation complete",
      },
      {
        id: "t2",
        fromTeam: "integration",
        toTeam: "ms",
        transferredBy: "Rahul Verma",
        transferredAt: "2025-01-15T14:00:00Z",
        notes: "Integration complete, ready for go-live support",
      },
    ],
    checklist: createChecklistForProject("proj-3", [
      { title: "Requirement gathering", phase: "mint" },
      { title: "Feasibility Analysis", phase: "mint" },
      { title: "BRD Details", phase: "mint" },
      { title: "Technical Scoping", phase: "mint" },
      { title: "Technical Walkthrough", phase: "mint" },
      { title: "API Validation", phase: "mint" },
      { title: "LCNC Config", phase: "mint" },
      { title: "Create JIRA", phase: "mint" },
      { title: "Transfer to Integration", phase: "mint" },
      { title: "BRD Validation", phase: "integration" },
      { title: "Integration Checklist", phase: "integration" },
      { title: "Sandbox Testing", phase: "integration" },
      { title: "Production Testing", phase: "integration" },
      { title: "Dashboard Walkthrough with MS", phase: "integration" },
      { title: "Go-Live", phase: "integration" },
    ]),
    currentResponsibility: "gokwik",
    responsibilityLog: [
      { id: "r1", party: "gokwik", startedAt: "2024-12-01T09:00:00Z", endedAt: "2024-12-05T17:00:00Z", phase: "mint" },
      { id: "r2", party: "merchant", startedAt: "2024-12-05T17:00:00Z", endedAt: "2024-12-10T09:00:00Z", phase: "mint" },
      { id: "r3", party: "gokwik", startedAt: "2024-12-10T11:00:00Z", endedAt: "2025-01-10T12:00:00Z", phase: "integration" },
      { id: "r4", party: "merchant", startedAt: "2025-01-10T12:00:00Z", endedAt: "2025-01-15T14:00:00Z", phase: "integration" },
      { id: "r5", party: "gokwik", startedAt: "2025-01-15T14:00:00Z", phase: "ms" },
    ],
  },
];
