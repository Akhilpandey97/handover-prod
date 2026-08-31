ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS due_date date;

CREATE TABLE IF NOT EXISTS public.checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id),
  title text not null,
  completed boolean not null default false,
  due_date date,
  assignee text,
  sort_order integer default 0,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_tasks TO authenticated;
GRANT ALL ON public.checklist_tasks TO service_role;

ALTER TABLE public.checklist_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist tasks viewable by tenant" ON public.checklist_tasks
FOR SELECT TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can create checklist tasks" ON public.checklist_tasks
FOR INSERT TO authenticated
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can update checklist tasks" ON public.checklist_tasks
FOR UPDATE TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can delete checklist tasks" ON public.checklist_tasks
FOR DELETE TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_item ON public.checklist_tasks(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_project ON public.checklist_tasks(project_id);