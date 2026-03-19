import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type TeamRole = Database["public"]["Enums"]["team_role"];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  team: TeamRole;
  tenantId: string | null;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string, team: TeamRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const BOOTSTRAP_USER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-user`;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrapUser = async (activeSession: Session) => {
    const response = await fetch(BOOTSTRAP_USER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeSession.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to bootstrap user account");
    }
  };

  const fetchUserProfile = async (userId: string, activeSession?: Session | null): Promise<AuthUser | null> => {
    try {
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, team, tenant_id")
        .eq("id", userId)
        .maybeSingle();

      let { data: roleData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      const needsBootstrap = !profile || !roleData?.role || (!profile.tenant_id && !roleData?.tenant_id);

      if (needsBootstrap && activeSession) {
        await bootstrapUser(activeSession);

        const profileResult = await supabase
          .from("profiles")
          .select("id, name, email, team, tenant_id")
          .eq("id", userId)
          .maybeSingle();
        profile = profileResult.data;
        profileError = profileResult.error;

        const roleResult = await supabase
          .from("user_roles")
          .select("role, tenant_id")
          .eq("user_id", userId)
          .maybeSingle();
        roleData = roleResult.data;
      }

      if (profileError || !profile) {
        console.error("Error fetching profile:", profileError);
        return null;
      }

      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        team: (roleData?.role || profile.team) as TeamRole,
        tenantId: roleData?.tenant_id || profile.tenant_id,
      };
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncFromSession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const userProfile = await fetchUserProfile(nextSession.user.id, nextSession);

      if (!isMounted) return;

      setCurrentUser(userProfile);
      setIsLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncFromSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void syncFromSession(existingSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session?.user) {
        const userProfile = await fetchUserProfile(data.session.user.id, data.session);
        setSession(data.session);
        setCurrentUser(userProfile);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    team: TeamRole,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name,
            team,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        login,
        signup,
        logout,
        isAuthenticated: currentUser !== null,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
