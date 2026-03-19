import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SECRET_FIELDS = [
  { key: "RESEND_API_KEY", label: "Resend API Key", description: "Used for sending email notifications" },
  { key: "GOOGLE_CLIENT_ID", label: "Google Client ID", description: "Gmail OAuth client ID for email polling" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", description: "Gmail OAuth client secret" },
  { key: "GOOGLE_REFRESH_TOKEN", label: "Google Refresh Token", description: "Gmail OAuth refresh token for email polling" },
];

export const SecretsManager = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("category", "secrets");

      if (error) throw error;

      const loaded: Record<string, string> = {};
      data?.forEach((row) => {
        loaded[row.key] = row.value;
      });
      setValues(loaded);
    } catch (err) {
      console.error("Failed to load secrets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const field of SECRET_FIELDS) {
        const val = values[field.key];
        if (val === undefined) continue;

        const { data: existing } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", field.key)
          .eq("category", "secrets")
          .maybeSingle();

        if (existing) {
          await supabase
            .from("app_settings")
            .update({ value: val, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else if (val) {
          await supabase
            .from("app_settings")
            .insert({ key: field.key, value: val, category: "secrets" });
        }
      }
      toast.success("Secrets saved successfully");
    } catch (err) {
      console.error("Failed to save secrets:", err);
      toast.error("Failed to save secrets");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = (key: string) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (val: string) => {
    if (!val || val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "••••••••" + val.slice(-4);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Update Secrets
        </CardTitle>
        <CardDescription>
          Manage API keys and tokens used by backend functions. These values are stored securely and used for email notifications and Gmail integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {SECRET_FIELDS.map(({ key, label, description }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key} className="text-sm font-medium">
              {label}
            </Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div className="relative">
              <Input
                id={key}
                type={visibility[key] ? "text" : "password"}
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={key}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => toggleVisibility(key)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {visibility[key] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
