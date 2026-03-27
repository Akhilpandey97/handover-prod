import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, LogIn, Shield, ShieldCheck, Sparkles, UserPlus, Zap } from "lucide-react";
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
  const orgName = labels.org_name?.toLowerCase().includes("gokwik") ? "Enterprise" : labels.org_name || "Enterprise";

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Hero Panel */}
        <section className="relative hidden overflow-hidden lg:flex">
          {/* Layered background */}
          <div className="absolute inset-0 bg-[hsl(222,40%,10%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,hsl(221,67%,37%,0.35),transparent),radial-gradient(ellipse_60%_50%_at_90%_80%,hsl(198,88%,45%,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(0,0%,100%,0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(0,0%,100%,0.03)_1px,transparent_1px)] bg-[size:56px_56px]" />
          {/* Top glow accent */}
          <div className="absolute -top-32 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-[hsl(221,67%,37%,0.2)] blur-[120px]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(0,0%,100%,0.1)] ring-1 ring-[hsl(0,0%,100%,0.12)]">
                  <Building2 className="h-5 w-5 text-[hsl(0,0%,100%,0.9)]" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(0,0%,100%,0.5)]">{orgName}</p>
                  <h1 className="text-lg font-bold tracking-[-0.03em] text-[hsl(0,0%,100%,0.95)]">{brandName}</h1>
                </div>
              </div>
              <ThemeToggle variant="secondary" className="h-9 w-9 border-[hsl(0,0%,100%,0.1)] bg-[hsl(0,0%,100%,0.06)] text-[hsl(0,0%,100%,0.7)] hover:bg-[hsl(0,0%,100%,0.1)] hover:text-[hsl(0,0%,100%,0.9)]" />
            </div>

            {/* Hero content */}
            <div className="max-w-[540px] space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(221,67%,37%,0.25)] px-4 py-1.5 ring-1 ring-[hsl(221,67%,37%,0.3)]">
                <Sparkles className="h-3.5 w-3.5 text-[hsl(217,90%,76%)]" />
                <span className="text-xs font-medium tracking-wide text-[hsl(217,90%,76%)]">Enterprise operating layer</span>
              </div>

              <h2 className="text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-[hsl(0,0%,100%,0.97)]">
                Run project handoffs with total control & visibility.
              </h2>

              <p className="max-w-md text-[15px] leading-7 text-[hsl(0,0%,100%,0.55)]">
                Boardroom-ready command centre for enterprise onboarding, inter-team execution, and delivery accountability.
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Delivery governance", value: "24×7" },
                  { label: "Cross-team visibility", value: "Unified" },
                  { label: "Executive reporting", value: "Realtime" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-[hsl(0,0%,100%,0.06)] p-4 ring-1 ring-[hsl(0,0%,100%,0.08)]">
                    <p className="text-xl font-bold tracking-[-0.02em] text-[hsl(0,0%,100%,0.92)]">{item.value}</p>
                    <p className="mt-0.5 text-xs text-[hsl(0,0%,100%,0.45)]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom features */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, text: "Structured workflows for presales, integration, and merchant success." },
                { icon: CheckCircle2, text: "Enterprise-grade oversight with owner-level accountability." },
                { icon: Zap, text: "Built for premium buyer confidence in demos and procurement reviews." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 rounded-xl bg-[hsl(0,0%,100%,0.04)] p-4 ring-1 ring-[hsl(0,0%,100%,0.06)]">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(217,90%,70%,0.7)]" />
                  <p className="text-[13px] leading-5 text-[hsl(0,0%,100%,0.5)]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className="relative flex items-center justify-center border-l border-border/40 bg-background px-6 py-10 lg:px-12">
          {/* Subtle background texture */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.04),transparent_50%)]" />

          <div className="absolute right-6 top-6 lg:hidden">
            <ThemeToggle />
          </div>

          <div className="relative z-10 w-full max-w-[420px] space-y-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{orgName}</p>
                <h1 className="text-lg font-bold tracking-[-0.03em]">{brandName}</h1>
              </div>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Enterprise Access</p>
              <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-foreground">
                {isSignup ? "Create account" : "Welcome back"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isSignup
                  ? "Provision a secure account for your delivery team."
                  : "Sign in to access the command centre and continue operations."}
              </p>
            </div>

            {/* Form card */}
            <Card className="overflow-hidden border-border/50 bg-card/90 shadow-xl shadow-foreground/[0.04] backdrop-blur-sm">
              <CardContent className="p-6">
                {/* Tab toggle */}
                <div className="mb-5 flex rounded-xl bg-muted/50 p-1">
                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${!isSignup ? "bg-card text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground/70"}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignup(true)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${isSignup ? "bg-card text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground/70"}`}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
                  {isSignup && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Enter full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Work Email</Label>
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
                    <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-11"
                    />
                  </div>

                  {isSignup && (
                    <div className="space-y-1.5">
                      <Label htmlFor="team" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Operating Role</Label>
                      <Select value={team} onValueChange={(value) => setTeam(value as TeamRole)}>
                        <SelectTrigger className="h-11">
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

                  <div className="flex items-center gap-2.5 pt-1">
                    <Button type="submit" className="h-11 flex-1 text-sm" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                          Please wait…
                        </span>
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
                    <div className="flex h-11 items-center gap-1.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 text-xs font-medium text-muted-foreground">
                      <LockKeyhole className="h-3.5 w-3.5 text-primary/70" />
                      Secure
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Bottom feature cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: ShieldCheck, title: "Access control", text: "Role-aware login and tenant isolation." },
                { icon: Building2, title: "Enterprise ready", text: "Built for procurement-friendly demos." },
                { icon: ArrowRight, title: "Fast handoff", text: "Move from sign-in to operations instantly." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border/40 bg-card/60 p-3.5 transition-colors hover:bg-card/80">
                  <item.icon className="mb-2.5 h-4 w-4 text-primary/80" />
                  <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
