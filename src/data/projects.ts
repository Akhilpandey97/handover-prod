export type HandoffStatus = "pending" | "accepted" | "in_progress" | "completed";
export type ProjectPhase = "scoping" | "api_build" | "integration" | "testing" | "live";

export interface TeamMember {
  id: string;
  name: string;
  role: "mint" | "sales" | "ms" | "ops";
  avatar?: string;
}

export interface Project {
  id: string;
  merchantName: string;
  mid: string;
  uif: string;
  platform: string;
  category: string;
  kickOffDate: string;
  goLiveDate: string;
  projectPhase: ProjectPhase;
  handoffStatus: HandoffStatus;
  arr: number;
  txnsPerDay: number;
  aov: number;
  webPercent: number;
  mobilePercent: number | null;
  prepaidCodSplit: string;
  assignedTo: string;
  handoffFrom: string;
  team: {
    mint: string;
    salesSpoc: string;
    ms: string;
    sales: string;
  };
  mobilePlatform: string | null;
  mobileCategory: string | null;
  phaseOwner: string;
  integrationType: string;
  customisations: string;
  pgOnboarding: string;
  phase2Needed: string;
  ageDays: number;
  goLivePercent: number;
  brandUrl: string;
  projectJira: string;
  apiQcChecklist: string | null;
  brdLink: string;
  goLiveChecklist: string;
  mintNotes: string | null;
  projectNotes: string;
  phaseComment: string;
  opsComments: string | null;
  phase2Notes: string;
  gokwikTime: string;
  merchantTime: string;
}

export const currentUser: TeamMember = {
  id: "user1",
  name: "Rahul Kumar",
  role: "ms",
};

export const projects: Project[] = [
  {
    id: "1",
    merchantName: "Ethera Diamonds",
    mid: "19tpy3qnz5dq",
    uif: "UID-etheradiamonds.com",
    platform: "Custom",
    category: "Gems & Jewellery",
    kickOffDate: "13/11/2025",
    goLiveDate: "",
    projectPhase: "integration",
    handoffStatus: "pending",
    arr: 8.135,
    txnsPerDay: 8,
    aov: 50000,
    webPercent: 100,
    mobilePercent: null,
    prepaidCodSplit: "85-15",
    assignedTo: "user1",
    handoffFrom: "MINT Team",
    team: {
      mint: "MINT",
      salesSpoc: "Saurabh",
      ms: "Mohit Raysoni",
      sales: "Saurabh",
    },
    mobilePlatform: null,
    mobileCategory: null,
    phaseOwner: "MINT",
    integrationType: "Advanced",
    customisations: "NA",
    pgOnboarding: "Easebuzz",
    phase2Needed: "No",
    ageDays: 14,
    goLivePercent: 45,
    brandUrl: "https://www.etheradiamonds.com/",
    projectJira: "https://gokwik.atlassian.net/browse/CUST-262",
    apiQcChecklist: null,
    brdLink: "https://docs.google.com/spreadsheets/d/1kgx4CaIrv3ib3zu37myy6C5CeVM7SE1la1JTxE7fEB0/edit",
    goLiveChecklist: "https://docs.google.com/spreadsheets/d/1kgx4CaIrv3ib3zu37myy6C5CeVM7SE1la1JTxE7fEB0/edit",
    mintNotes: null,
    projectNotes: "Checkout lite, PAN card implementation and KP Integration",
    phaseComment: "Initial scoping and API walkthrough is done.\n\nAwaiting update on API dev.\n\n16th Jan:\nIn prod testing currently, sandbox testing is done, we got the PG creds yesterday\n\n21st Jan:\nPPCOD decision pending - to decide the % of prepaid amount to be taken from the customer",
    opsComments: null,
    phase2Notes: "Coupons\nKP SSO\nThey don't have AWB tracking, currently managing on excel sheets",
    gokwikTime: "0h",
    merchantTime: "0h",
  },
  {
    id: "2",
    merchantName: "Livspace",
    mid: "19u5u9kt1urj",
    uif: "UID-livspace.com",
    platform: "Custom",
    category: "Home & Living",
    kickOffDate: "14/11/2025",
    goLiveDate: "",
    projectPhase: "api_build",
    handoffStatus: "accepted",
    arr: 0.1,
    txnsPerDay: 2,
    aov: 150000,
    webPercent: 70,
    mobilePercent: 30,
    prepaidCodSplit: "95-5",
    assignedTo: "user1",
    handoffFrom: "MINT Team",
    team: {
      mint: "MINT",
      salesSpoc: "Rahul",
      ms: "Priya Singh",
      sales: "Rahul",
    },
    mobilePlatform: "React Native",
    mobileCategory: "App",
    phaseOwner: "MINT",
    integrationType: "Standard",
    customisations: "Custom checkout flow",
    pgOnboarding: "Razorpay",
    phase2Needed: "Yes",
    ageDays: 10,
    goLivePercent: 25,
    brandUrl: "https://www.livspace.com/",
    projectJira: "https://gokwik.atlassian.net/browse/CUST-263",
    apiQcChecklist: null,
    brdLink: "https://docs.google.com/spreadsheets/d/example",
    goLiveChecklist: "https://docs.google.com/spreadsheets/d/example",
    mintNotes: "High priority client",
    projectNotes: "Full integration with custom design system",
    phaseComment: "API documentation review in progress",
    opsComments: null,
    phase2Notes: "Mobile app integration planned",
    gokwikTime: "4h",
    merchantTime: "2h",
  },
  {
    id: "3",
    merchantName: "TechMart India",
    mid: "19xyz789abc",
    uif: "UID-techmart.in",
    platform: "Shopify",
    category: "Electronics",
    kickOffDate: "01/11/2025",
    goLiveDate: "15/12/2025",
    projectPhase: "live",
    handoffStatus: "completed",
    arr: 25.5,
    txnsPerDay: 150,
    aov: 8500,
    webPercent: 60,
    mobilePercent: 40,
    prepaidCodSplit: "70-30",
    assignedTo: "user1",
    handoffFrom: "MINT Team",
    team: {
      mint: "MINT",
      salesSpoc: "Amit",
      ms: "Deepak Kumar",
      sales: "Amit",
    },
    mobilePlatform: "PWA",
    mobileCategory: "Web App",
    phaseOwner: "Ops",
    integrationType: "Standard",
    customisations: "NA",
    pgOnboarding: "PayU",
    phase2Needed: "No",
    ageDays: 45,
    goLivePercent: 100,
    brandUrl: "https://www.techmart.in/",
    projectJira: "https://gokwik.atlassian.net/browse/CUST-250",
    apiQcChecklist: "Completed",
    brdLink: "https://docs.google.com/spreadsheets/d/techmart",
    goLiveChecklist: "https://docs.google.com/spreadsheets/d/techmart-golive",
    mintNotes: "Smooth integration",
    projectNotes: "Standard Shopify integration",
    phaseComment: "Successfully launched. Monitoring performance.",
    opsComments: "All metrics within expected range",
    phase2Notes: "NA",
    gokwikTime: "12h",
    merchantTime: "8h",
  },
  {
    id: "4",
    merchantName: "Fashion Forward",
    mid: "19abc123xyz",
    uif: "UID-fashionforward.com",
    platform: "WooCommerce",
    category: "Fashion & Apparel",
    kickOffDate: "20/10/2025",
    goLiveDate: "",
    projectPhase: "testing",
    handoffStatus: "in_progress",
    arr: 12.8,
    txnsPerDay: 45,
    aov: 2500,
    webPercent: 45,
    mobilePercent: 55,
    prepaidCodSplit: "60-40",
    assignedTo: "user1",
    handoffFrom: "MINT Team",
    team: {
      mint: "MINT",
      salesSpoc: "Neha",
      ms: "Vikram Patel",
      sales: "Neha",
    },
    mobilePlatform: "Native iOS/Android",
    mobileCategory: "App",
    phaseOwner: "QA",
    integrationType: "Advanced",
    customisations: "Custom size guide, AR try-on",
    pgOnboarding: "Cashfree",
    phase2Needed: "Yes",
    ageDays: 30,
    goLivePercent: 75,
    brandUrl: "https://www.fashionforward.com/",
    projectJira: "https://gokwik.atlassian.net/browse/CUST-245",
    apiQcChecklist: "In Progress",
    brdLink: "https://docs.google.com/spreadsheets/d/fashion",
    goLiveChecklist: "https://docs.google.com/spreadsheets/d/fashion-golive",
    mintNotes: "Complex customizations",
    projectNotes: "AR try-on feature integration",
    phaseComment: "UAT in progress. Minor bugs being fixed.",
    opsComments: null,
    phase2Notes: "Loyalty program integration",
    gokwikTime: "20h",
    merchantTime: "15h",
  },
  {
    id: "5",
    merchantName: "Organic Basket",
    mid: "19def456ghi",
    uif: "UID-organicbasket.com",
    platform: "Magento",
    category: "Food & Grocery",
    kickOffDate: "05/11/2025",
    goLiveDate: "",
    projectPhase: "scoping",
    handoffStatus: "pending",
    arr: 5.2,
    txnsPerDay: 80,
    aov: 1200,
    webPercent: 80,
    mobilePercent: 20,
    prepaidCodSplit: "40-60",
    assignedTo: "user1",
    handoffFrom: "MINT Team",
    team: {
      mint: "MINT",
      salesSpoc: "Karan",
      ms: "Anjali Sharma",
      sales: "Karan",
    },
    mobilePlatform: null,
    mobileCategory: null,
    phaseOwner: "Sales",
    integrationType: "Standard",
    customisations: "Subscription boxes",
    pgOnboarding: "Pending",
    phase2Needed: "Yes",
    ageDays: 20,
    goLivePercent: 10,
    brandUrl: "https://www.organicbasket.com/",
    projectJira: "https://gokwik.atlassian.net/browse/CUST-270",
    apiQcChecklist: null,
    brdLink: "https://docs.google.com/spreadsheets/d/organic",
    goLiveChecklist: "",
    mintNotes: null,
    projectNotes: "Waiting for merchant decision on PG",
    phaseComment: "Project on hold - merchant evaluating options",
    opsComments: null,
    phase2Notes: "Subscription management system",
    gokwikTime: "2h",
    merchantTime: "0h",
  },
];

export const getPhaseLabel = (phase: ProjectPhase): string => {
  const labels: Record<ProjectPhase, string> = {
    scoping: "Scoping",
    api_build: "API Build",
    integration: "Integration",
    testing: "Testing",
    live: "Live",
  };
  return labels[phase];
};

export const getHandoffLabel = (status: HandoffStatus): string => {
  const labels: Record<HandoffStatus, string> = {
    pending: "Pending KT",
    accepted: "KT Accepted",
    in_progress: "In Progress",
    completed: "Completed",
  };
  return labels[status];
};
