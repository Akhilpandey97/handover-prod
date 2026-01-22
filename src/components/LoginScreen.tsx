import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { teamUsers, teamLabels, teamColors } from "@/data/teams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Users } from "lucide-react";

export const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email);
    if (success) {
      toast.success("Login successful!");
    } else {
      toast.error("Invalid credentials. Try one of the demo accounts.");
    }
  };

  const handleQuickLogin = (userEmail: string) => {
    setEmail(userEmail);
    const success = login(userEmail);
    if (success) {
      toast.success("Login successful!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold">ProjectHub</h1>
          <p className="text-muted-foreground">
            Project Handoff Management System
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your email to access your team dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo Accounts</CardTitle>
            <CardDescription>
              Click to login as any team member
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleQuickLogin(user.email)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted transition-colors text-left"
              >
                <div className={`h-10 w-10 rounded-full ${teamColors[user.team]} flex items-center justify-center text-white font-semibold`}>
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted font-medium">
                  {teamLabels[user.team]}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
