import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: string[];
  is_active: boolean;
  sort_order: number;
}

export interface CustomFieldValue {
  field_id: string;
  value: string | null;
}

export const useCustomFields = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!error && data) {
        setFields(data.map((f: any) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options : [],
        })));
      }
      setIsLoading(false);
    };
    fetch();
  }, []);

  return { fields, isLoading };
};

export const useCustomFieldValues = (projectId: string | undefined) => {
  const { currentUser } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); return; }
    const fetch = async () => {
      const { data, error } = await supabase
        .from("custom_field_values")
        .select("field_id, value")
        .eq("project_id", projectId);
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { if (r.value) map[r.field_id] = r.value; });
        setValues(map);
      }
      setIsLoading(false);
    };
    fetch();
  }, [projectId]);

  const saveValues = useCallback(async (projectId: string, fieldValues: Record<string, string>) => {
    const tenantId = currentUser?.tenantId || null;
    const rows = Object.entries(fieldValues)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([field_id, value]) => ({
        project_id: projectId,
        field_id,
        value,
        tenant_id: tenantId,
      }));

    if (rows.length === 0) return;

    for (const row of rows) {
      const { data: existing } = await supabase
        .from("custom_field_values")
        .select("id")
        .eq("project_id", row.project_id)
        .eq("field_id", row.field_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("custom_field_values").update({ value: row.value }).eq("id", existing.id);
      } else {
        await supabase.from("custom_field_values").insert(row);
      }
    }
  }, [currentUser?.tenantId]);

  return { values, setValues, isLoading, saveValues };
};

/** Batch-fetch custom field values for multiple projects at once */
export const useAllCustomFieldValues = (projectIds: string[]) => {
  const [valuesMap, setValuesMap] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectIds.length === 0) { setIsLoading(false); return; }
    const fetch = async () => {
      const { data, error } = await supabase
        .from("custom_field_values")
        .select("project_id, field_id, value")
        .in("project_id", projectIds);
      if (!error && data) {
        const map: Record<string, Record<string, string>> = {};
        data.forEach((r: any) => {
          if (r.value) {
            if (!map[r.project_id]) map[r.project_id] = {};
            map[r.project_id][r.field_id] = r.value;
          }
        });
        setValuesMap(map);
      }
      setIsLoading(false);
    };
    fetch();
  }, [projectIds.join(",")]);

  return { valuesMap, isLoading };
};
