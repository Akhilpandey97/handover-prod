import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, Building2, LockKeyhole, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "./ThemeToggle";
import type { Database } from "@/integrations/supabase/types";
import { useLabels } from "@/contexts/LabelsContext";

type TeamRole = Database["public"]["Enums"]["team_role"];

export const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState<TeamRole>("mint");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();
  const { teamLabels, labels } = useLabels();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(email, password);
    if (result.success) {
      toast.success("Login successful");
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
      toast.success("Account created. Sign in to continue.");
      setIsSignup(false);
      setPassword("");
    } else {
      toast.error(result.error || "Failed to create account");
    }
    setIsLoading(false);
  };

  const brandName = labels.app_title || "Command Centre";
  const orgName = labels.org_name || "Enterprise";

  return (
    <div className="min-h-screen bg-background enterprise-grid">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden overflow-hidden border-r border-border/60 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34%),radial-gradient(circle_at_80%_20%,hsl(var(--info)/0.18),transparent_28%),linear-gradient(160deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.94)_58%,hsl(var(--primary)/0.82)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary-foreground)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary-foreground)/0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 text-primary-foreground xl:p-14">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 backdrop-blur-xl">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-primary-foreground/70">{orgName}</p>
                  <h1 className="text-2xl font-semibold tracking-[-0.03em]">{brandName}</h1>
                </div>
              </div>
              <ThemeToggle variant="secondary" className="border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" />
            </div>

            <div className="max-w-2xl space-y-8">
              <Badge variant="secondary" className="w-fit border-primary-foreground/10 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground">
                Trusted operating layer for enterprise onboarding
              </Badge>
              <div className="space-y-5">
                <h2 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em]">
                  Run enterprise project handoffs with auditability, control, and executive visibility.
                </h2>
                <p className="max-w-xl text-base leading-7 text-primary-foreground/78">
                  A boardroom-ready command centre for large Indian enterprises managing merchant onboarding, inter-team execution, and delivery accountability.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Delivery governance", value: "24x7" },
                  { label: "Cross-team visibility", value: "Unified" },
                  { label: "Executive reporting", value: "Realtime" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/8 p-5 backdrop-blur-xl">
                    <p className="text-2xl font-semibold tracking-[-0.03em]">{item.value}</p>
                    <p className="mt-1 text-sm text-primary-foreground/72">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm text-primary-foreground/76">
              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/8 p-4">Structured workflows for presales, integration, and merchant success.</div>
              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/8 p-4">Enterprise-grade oversight with owner-level accountability.</div>
              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/8 p-4">Designed for premium buyer confidence in demos and procurement reviews.</div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 lg:px-10">
          <div className="absolute right-6 top-6 lg:hidden">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{orgName}</p>
                  <h1 className="text-xl font-semibold tracking-[-0.03em]">{brandName}</h1>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Enterprise Access</p>
                <h2 className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
                  {isSignup ? "Create operator account" : "Welcome back"}
                </h2>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {isSignup
                    ? "Provision a secure account for your delivery team."
                    : "Sign in to access the enterprise command centre and continue operations."}
                </p>
              </div>
            </div>

            <Card className="enterprise-panel overflow-hidden">
              <CardContent className="p-8">
                <div className="mb-6 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/35 p-2">
                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${!isSignup ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignup(true)}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${isSignup ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-5">
                  {isSignup && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Enter full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-12"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Work Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12"
                    />
                  </div>

                  {isSignup && (
                    <div className="space-y-2">
                      <Label htmlFor="team" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Operating Role</Label>
                      <Select value={team} onValueChange={(value) => setTeam(value as TeamRole)}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select your team" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(teamLabels) as TeamRole[])
                            .filter((role) => role !== "super_admin")
                            .map((role) => (
                              <SelectItem key={role} value={role}>
                                {teamLabels[role]}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-3 pt-2 sm:grid-cols-[1fr_auto]">
                    <Button type="submit" className="h-12 w-full justify-center text-sm" disabled={isLoading}>
                      {isLoading ? (
                        "Please wait..."
                      ) : isSignup ? (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Create Account
                        </>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4" />
                          Sign In
                        </>
                      )}
                    </Button>
                    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 text-sm text-muted-foreground">
                      <LockKeyhole className="h-4 w-4 text-primary" />
                      Secure access
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Access control", text: "Role-aware login and tenant isolation." },
                { icon: Building2, title: "Enterprise ready", text: "Built for procurement-friendly demos." },
                { icon: ArrowRight, title: "Fast handoff", text: "Move from sign-in to operations instantly." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-xl">
                  <item.icon className="mb-3 h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
