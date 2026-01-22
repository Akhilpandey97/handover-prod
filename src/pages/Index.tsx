import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/LoginScreen";
import { TeamDashboard } from "@/components/TeamDashboard";
import { ManagerDashboard } from "@/components/ManagerDashboard";

const Index = () => {
  const { isAuthenticated, currentUser } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show manager dashboard for manager role
  if (currentUser?.team === "manager") {
    return <ManagerDashboard />;
  }

  return <TeamDashboard />;
};

export default Index;
