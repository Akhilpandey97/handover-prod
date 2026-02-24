
-- Create dedicated checklist_templates table (independent of projects)
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  owner_team public.team_role NOT NULL,
  phase public.project_phase NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(title, owner_team, tenant_id)
);

-- Enable RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Templates viewable by tenant"
  ON public.checklist_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can create templates"
  ON public.checklist_templates FOR INSERT
  WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can update templates"
  ON public.checklist_templates FOR UPDATE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can delete templates"
  ON public.checklist_templates FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Seed templates from existing checklist_items (deduplicated)
INSERT INTO public.checklist_templates (title, owner_team, phase, sort_order, tenant_id)
SELECT DISTINCT ON (ci.owner_team, ci.title, ci.tenant_id)
  ci.title, ci.owner_team, ci.phase, ci.sort_order, ci.tenant_id
FROM public.checklist_items ci
ORDER BY ci.owner_team, ci.title, ci.tenant_id, ci.sort_order;
