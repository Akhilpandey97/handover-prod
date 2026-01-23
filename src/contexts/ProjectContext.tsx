import React, { createContext, useContext, useState, ReactNode } from "react";
import { Project, initialProjects, TransferRecord, ResponsibilityParty, ProjectChecklist } from "@/data/projectsData";
import { TeamRole } from "@/data/teams";
import { useAuth } from "./AuthContext";

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  acceptProject: (projectId: string) => void;
  transferProject: (projectId: string, notes?: string) => void;
  updateChecklist: (projectId: string, checklistId: string, completed: boolean) => void;
  updateChecklistComment: (projectId: string, checklistId: string, comment: string) => void;
  toggleResponsibility: (projectId: string, party: ResponsibilityParty) => void;
  toggleChecklistResponsibility: (projectId: string, checklistId: string, party: ResponsibilityParty) => void;
  getProjectsForTeam: (team: TeamRole) => Project[];
  getPendingProjects: (team: TeamRole) => Project[];
  getActiveProjects: (team: TeamRole) => Project[];
  getCompletedProjects: (team: TeamRole) => Project[];
  getAllProjects: () => Project[];
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

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
  };

  const updateProject = (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

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
    if (!currentUser) return;
    
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            checklist: p.checklist.map((c) => {
              if (c.id === checklistId) {
                // Only allow the owner team to complete their items
                if (c.ownerTeam !== currentUser.team && currentUser.team !== "manager") {
                  return c;
                }
                return {
                  ...c,
                  completed,
                  completedBy: completed ? currentUser.name : undefined,
                  completedAt: completed ? new Date().toISOString() : undefined,
                };
              }
              return c;
            }),
          };
        }
        return p;
      })
    );
  };

  const updateChecklistComment = (projectId: string, checklistId: string, comment: string) => {
    if (!currentUser) return;
    
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            checklist: p.checklist.map((c) => {
              if (c.id === checklistId) {
                return {
                  ...c,
                  comment,
                  commentBy: currentUser.name,
                  commentAt: new Date().toISOString(),
                };
              }
              return c;
            }),
          };
        }
        return p;
      })
    );
  };

  const toggleResponsibility = (projectId: string, newParty: ResponsibilityParty) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId && p.currentResponsibility !== newParty) {
          // Close the current responsibility log
          const updatedLog = p.responsibilityLog.map((log, idx) => {
            if (idx === p.responsibilityLog.length - 1 && !log.endedAt) {
              return { ...log, endedAt: new Date().toISOString() };
            }
            return log;
          });

          // Add new responsibility log entry
          const newLogEntry = {
            id: `r-${Date.now()}`,
            party: newParty,
            startedAt: new Date().toISOString(),
            phase: p.currentPhase,
          };

          return {
            ...p,
            currentResponsibility: newParty,
            responsibilityLog: [...updatedLog, newLogEntry],
          };
        }
        return p;
      })
    );
  };

  const toggleChecklistResponsibility = (projectId: string, checklistId: string, newParty: ResponsibilityParty) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            checklist: p.checklist.map((c) => {
              if (c.id === checklistId && c.currentResponsibility !== newParty) {
                // Close the current responsibility log
                const updatedLog = c.responsibilityLog.map((log, idx) => {
                  if (idx === c.responsibilityLog.length - 1 && !log.endedAt) {
                    return { ...log, endedAt: new Date().toISOString() };
                  }
                  return log;
                });

                // Add new responsibility log entry
                const newLogEntry = {
                  id: `cl-${Date.now()}`,
                  party: newParty,
                  startedAt: new Date().toISOString(),
                };

                return {
                  ...c,
                  currentResponsibility: newParty,
                  responsibilityLog: [...updatedLog, newLogEntry],
                };
              }
              return c;
            }),
          };
        }
        return p;
      })
    );
  };

  const getProjectsForTeam = (team: TeamRole) => {
    if (team === "manager") return projects;
    return projects.filter((p) => p.currentOwnerTeam === team);
  };

  const getPendingProjects = (team: TeamRole) => {
    if (team === "manager") return projects.filter((p) => p.pendingAcceptance);
    return projects.filter((p) => p.currentOwnerTeam === team && p.pendingAcceptance);
  };

  const getActiveProjects = (team: TeamRole) => {
    if (team === "manager") return projects.filter((p) => !p.pendingAcceptance && p.currentPhase !== "completed");
    return projects.filter((p) => p.currentOwnerTeam === team && !p.pendingAcceptance && p.currentPhase !== "completed");
  };

  const getCompletedProjects = (team: TeamRole) => {
    return projects.filter((p) => p.currentPhase === "completed");
  };

  const getAllProjects = () => projects;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        addProject,
        updateProject,
        acceptProject,
        transferProject,
        updateChecklist,
        updateChecklistComment,
        toggleResponsibility,
        toggleChecklistResponsibility,
        getProjectsForTeam,
        getPendingProjects,
        getActiveProjects,
        getCompletedProjects,
        getAllProjects,
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
