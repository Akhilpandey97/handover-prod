import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/LoginScreen";
import { TeamDashboard } from "@/components/TeamDashboard";
import { ManagerDashboard } from "@/components/ManagerDashboard";
import { AiChatBot } from "@/components/AiChatBot";

const Index = () => {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show manager dashboard for manager or super_admin role
  if (currentUser?.team === "manager" || currentUser?.team === "super_admin") {
    return (
      <>
        <ManagerDashboard />
        <AiChatBot />
      </>
    );
  }

  return (
    <>
      <TeamDashboard />
      <AiChatBot />
    </>
  );
};

export default Index;
