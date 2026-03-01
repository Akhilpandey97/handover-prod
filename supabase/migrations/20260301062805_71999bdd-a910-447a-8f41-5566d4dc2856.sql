
-- Custom project fields table
CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text, number, date, select, url, boolean
  options jsonb DEFAULT '[]'::jsonb, -- for select type: ["Option1", "Option2"]
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, field_key)
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom fields viewable by tenant"
ON public.custom_fields FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can create custom fields"
ON public.custom_fields FOR INSERT
WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can update custom fields"
ON public.custom_fields FOR UPDATE
USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can delete custom fields"
ON public.custom_fields FOR DELETE
USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Custom field values for projects
CREATE TABLE public.custom_field_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, field_id)
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom field values viewable by tenant"
ON public.custom_field_values FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can create custom field values"
ON public.custom_field_values FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can update custom field values"
ON public.custom_field_values FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can delete custom field values"
ON public.custom_field_values FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
