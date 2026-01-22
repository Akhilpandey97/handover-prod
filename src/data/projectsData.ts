import { TeamRole } from "./teams";

export type ProjectPhase = "mint" | "integration" | "ms" | "completed";

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

export interface ProjectChecklist {
  id: string;
  title: string;
  completed: boolean;
  phase: ProjectPhase;
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
  kickOffDate: string;
  goLiveDate?: string;
  brandUrl: string;
  jiraLink?: string;
  brdLink?: string;
  mintNotes?: string;
  projectNotes?: string;
  phaseComment?: string;
  transferHistory: TransferRecord[];
  checklist: ProjectChecklist[];
  salesSpoc: string;
  integrationType: string;
  pgOnboarding: string;
}

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
    kickOffDate: "2025-01-13",
    brandUrl: "https://www.etheradiamonds.com/",
    jiraLink: "https://gokwik.atlassian.net/browse/CUST-262",
    brdLink: "https://docs.google.com/spreadsheets/d/example",
    mintNotes: "High priority client, CEO directly involved",
    projectNotes: "Checkout lite, PAN card implementation and KP Integration",
    phaseComment: "Initial scoping and API walkthrough is done. Awaiting update on API dev.",
    salesSpoc: "Saurabh",
    integrationType: "Advanced",
    pgOnboarding: "Easebuzz",
    transferHistory: [],
    checklist: [
      { id: "c1", title: "Initial client meeting completed", completed: true, phase: "mint" },
      { id: "c2", title: "Requirements documented", completed: true, phase: "mint" },
      { id: "c3", title: "BRD prepared", completed: false, phase: "mint" },
      { id: "c4", title: "API walkthrough done", completed: false, phase: "mint" },
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
    kickOffDate: "2025-01-14",
    brandUrl: "https://www.livspace.com/",
    jiraLink: "https://gokwik.atlassian.net/browse/CUST-301",
    mintNotes: "Fast-track requested by sales",
    projectNotes: "Standard checkout integration",
    phaseComment: "API development in progress",
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
    checklist: [
      { id: "c1", title: "Initial client meeting completed", completed: true, phase: "mint" },
      { id: "c2", title: "Requirements documented", completed: true, phase: "mint" },
      { id: "c3", title: "BRD prepared", completed: true, phase: "mint" },
      { id: "c4", title: "API credentials received", completed: false, phase: "integration" },
      { id: "c5", title: "Sandbox testing complete", completed: false, phase: "integration" },
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
    kickOffDate: "2024-12-01",
    goLiveDate: "2025-01-20",
    brandUrl: "https://www.urbancompany.com/",
    jiraLink: "https://gokwik.atlassian.net/browse/CUST-198",
    mintNotes: "Enterprise client",
    projectNotes: "Full checkout suite with loyalty integration",
    phaseComment: "Final testing before go-live",
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
    checklist: [
      { id: "c1", title: "Initial client meeting completed", completed: true, phase: "mint" },
      { id: "c2", title: "Requirements documented", completed: true, phase: "mint" },
      { id: "c3", title: "API integration complete", completed: true, phase: "integration" },
      { id: "c4", title: "UAT sign-off", completed: true, phase: "integration" },
      { id: "c5", title: "Go-live checklist reviewed", completed: false, phase: "ms" },
      { id: "c6", title: "Merchant training scheduled", completed: false, phase: "ms" },
    ],
  },
];
