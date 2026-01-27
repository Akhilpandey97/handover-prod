import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type TeamRole = Database["public"]["Enums"]["team_role"];

const teamLabels: Record<TeamRole, string> = {
  mint: "MINT (Presales)",
  integration: "Integration Team",
  ms: "MS (Merchant Success)",
  manager: "Manager",
};

export const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState<TeamRole>("mint");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast.success("Login successful!");
    } else {
      toast.error(result.error || "Invalid credentials");
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!name.trim()) {
      toast.error("Please enter your name");
      setIsLoading(false);
      return;
    }
    
    const result = await signup(email, password, name, team);
    
    if (result.success) {
      toast.success("Account created! You can now log in.");
      setIsSignup(false);
      setPassword("");
    } else {
      toast.error(result.error || "Failed to create account");
    }
    setIsLoading(false);
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
            <CardTitle>{isSignup ? "Create Account" : "Sign In"}</CardTitle>
            <CardDescription>
              {isSignup 
                ? "Create your account to get started" 
                : "Enter your credentials to access your dashboard"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select value={team} onValueChange={(value) => setTeam(value as TeamRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your team" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(teamLabels) as TeamRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {teamLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  "Please wait..."
                ) : isSignup ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setPassword("");
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignup 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Create one"
                }
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Contact your manager if you need help accessing your account.
        </p>
      </div>
    </div>
  );
};
