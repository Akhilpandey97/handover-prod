
-- Form templates (e.g. "BRD Form", "Onboarding Form")
CREATE TABLE public.checklist_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Form templates viewable by tenant" ON public.checklist_form_templates
  FOR SELECT TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can create form templates" ON public.checklist_form_templates
  FOR INSERT TO public WITH CHECK (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can update form templates" ON public.checklist_form_templates
  FOR UPDATE TO public USING (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can delete form templates" ON public.checklist_form_templates
  FOR DELETE TO public USING (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

-- Form fields (questions within a template)
CREATE TABLE public.checklist_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_form_templates(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  question text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Form fields viewable by tenant" ON public.checklist_form_fields
  FOR SELECT TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can create form fields" ON public.checklist_form_fields
  FOR INSERT TO public WITH CHECK (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can update form fields" ON public.checklist_form_fields
  FOR UPDATE TO public USING (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can delete form fields" ON public.checklist_form_fields
  FOR DELETE TO public USING (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

-- Assign forms to checklist template items
CREATE TABLE public.checklist_form_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  form_template_id uuid NOT NULL REFERENCES public.checklist_form_templates(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checklist_template_id, form_template_id)
);

ALTER TABLE public.checklist_form_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignments viewable by tenant" ON public.checklist_form_assignments
  FOR SELECT TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can create assignments" ON public.checklist_form_assignments
  FOR INSERT TO public WITH CHECK (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Managers can delete assignments" ON public.checklist_form_assignments
  FOR DELETE TO public USING (
    (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

-- Form responses (filled data per project per checklist item)
CREATE TABLE public.checklist_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  form_template_id uuid NOT NULL REFERENCES public.checklist_form_templates(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.checklist_form_fields(id) ON DELETE CASCADE,
  value text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, checklist_item_id, field_id)
);

ALTER TABLE public.checklist_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responses viewable by tenant" ON public.checklist_form_responses
  FOR SELECT TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Tenant users can create responses" ON public.checklist_form_responses
  FOR INSERT TO public WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Tenant users can update responses" ON public.checklist_form_responses
  FOR UPDATE TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
CREATE POLICY "Tenant users can delete responses" ON public.checklist_form_responses
  FOR DELETE TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );
