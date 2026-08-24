import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLabels } from "@/contexts/LabelsContext";

export const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();
  const { labels } = useLabels();

  const brandName = labels.app_title || "Handover";
  const orgName = labels.org_name?.toLowerCase().includes("gokwik") ? "Enterprise" : labels.org_name || "Enterprise";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (isSignup) {
      if (!name.trim()) {
        toast.error("Please enter your name");
        setIsLoading(false);
        return;
      }
      const result = await signup(email, password, name, "mint");
      if (result.success) {
        toast.success("Account created. Sign in to continue.");
        setIsSignup(false);
        setPassword("");
      } else {
        toast.error(result.error || "Failed to create account");
      }
    } else {
      const result = await login(email, password);
      if (result.success) {
        toast.success("Login successful");
      } else {
        toast.error(result.error || "Invalid credentials");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{brandName}</h1>
            <p className="text-xs text-muted-foreground">{orgName}</p>
          </div>
        </div>

        <Card className="border-border/60 bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {isSignup ? "Create account" : "Sign in"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignup ? "Enter your details to get started" : "Enter your details to continue"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                />
              </div>

              <Button type="submit" className="h-11 w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait…
                  </span>
                ) : isSignup ? (
                  "Create account"
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setPassword("");
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {isSignup ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
