export type TeamRole = "mint" | "integration" | "ms";

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  team: TeamRole;
  avatar?: string;
}

export const teamUsers: TeamUser[] = [
  {
    id: "user-mint-1",
    name: "Priya Sharma",
    email: "priya@mint.com",
    team: "mint",
  },
  {
    id: "user-int-1",
    name: "Rahul Verma",
    email: "rahul@integration.com",
    team: "integration",
  },
  {
    id: "user-ms-1",
    name: "Anjali Patel",
    email: "anjali@ms.com",
    team: "ms",
  },
];

export const teamLabels: Record<TeamRole, string> = {
  mint: "MINT (Presales)",
  integration: "Integration Team",
  ms: "MS (Merchant Success)",
};

export const teamColors: Record<TeamRole, string> = {
  mint: "bg-blue-500",
  integration: "bg-purple-500",
  ms: "bg-green-500",
};
