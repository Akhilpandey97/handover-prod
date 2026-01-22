import React, { createContext, useContext, useState, ReactNode } from "react";
import { Project, initialProjects, TransferRecord } from "@/data/projectsData";
import { TeamRole } from "@/data/teams";
import { useAuth } from "./AuthContext";

interface ProjectContextType {
  projects: Project[];
  acceptProject: (projectId: string) => void;
  transferProject: (projectId: string, notes?: string) => void;
  updateChecklist: (projectId: string, checklistId: string, completed: boolean) => void;
  getProjectsForTeam: (team: TeamRole) => Project[];
  getPendingProjects: (team: TeamRole) => Project[];
  getActiveProjects: (team: TeamRole) => Project[];
  getCompletedProjects: (team: TeamRole) => Project[];
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const getNextTeam = (current: TeamRole): TeamRole | null => {
  if (current === "mint") return "integration";
  if (current === "integration") return "ms";
  return null;
};

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const { currentUser } = useAuth();

  const acceptProject = (projectId: string) => {
    if (!currentUser) return;
    
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId && p.pendingAcceptance) {
          const updatedHistory = p.transferHistory.map((t, idx) => {
            if (idx === p.transferHistory.length - 1 && !t.acceptedBy) {
              return {
                ...t,
                acceptedBy: currentUser.name,
                acceptedAt: new Date().toISOString(),
              };
            }
            return t;
          });
          return { ...p, pendingAcceptance: false, transferHistory: updatedHistory };
        }
        return p;
      })
    );
  };

  const transferProject = (projectId: string, notes?: string) => {
    if (!currentUser) return;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId && p.currentOwnerTeam === currentUser.team) {
          const nextTeam = getNextTeam(currentUser.team);
          if (!nextTeam) return p;

          const newTransfer: TransferRecord = {
            id: `t-${Date.now()}`,
            fromTeam: currentUser.team,
            toTeam: nextTeam,
            transferredBy: currentUser.name,
            transferredAt: new Date().toISOString(),
            notes,
          };

          const nextPhase = nextTeam === "integration" ? "integration" : nextTeam === "ms" ? "ms" : p.currentPhase;

          return {
            ...p,
            currentOwnerTeam: nextTeam,
            currentPhase: nextPhase,
            pendingAcceptance: true,
            transferHistory: [...p.transferHistory, newTransfer],
          };
        }
        return p;
      })
    );
  };

  const updateChecklist = (projectId: string, checklistId: string, completed: boolean) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            checklist: p.checklist.map((c) =>
              c.id === checklistId ? { ...c, completed } : c
            ),
          };
        }
        return p;
      })
    );
  };

  const getProjectsForTeam = (team: TeamRole) => {
    return projects.filter((p) => p.currentOwnerTeam === team);
  };

  const getPendingProjects = (team: TeamRole) => {
    return projects.filter((p) => p.currentOwnerTeam === team && p.pendingAcceptance);
  };

  const getActiveProjects = (team: TeamRole) => {
    return projects.filter((p) => p.currentOwnerTeam === team && !p.pendingAcceptance && p.currentPhase !== "completed");
  };

  const getCompletedProjects = (team: TeamRole) => {
    return projects.filter((p) => p.currentPhase === "completed");
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        acceptProject,
        transferProject,
        updateChecklist,
        getProjectsForTeam,
        getPendingProjects,
        getActiveProjects,
        getCompletedProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
};
