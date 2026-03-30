import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/LoginScreen";
import { TeamDashboard } from "@/components/TeamDashboard";
import { ManagerDashboard } from "@/components/ManagerDashboard";
import { AiChatBot } from "@/components/AiChatBot";

const Index = () => {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <DashboardSkeleton />;
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
