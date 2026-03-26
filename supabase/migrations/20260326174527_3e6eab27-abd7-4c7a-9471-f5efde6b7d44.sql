
-- Workflows table for AI chatbot automation rules
CREATE TABLE public.chat_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  created_by uuid,
  name text NOT NULL,
  description text,
  trigger_field text NOT NULL,
  trigger_value text,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflows viewable by tenant" ON public.chat_workflows FOR SELECT TO public USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can create workflows" ON public.chat_workflows FOR INSERT TO public WITH CHECK (
  (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can update workflows" ON public.chat_workflows FOR UPDATE TO public USING (
  (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can delete workflows" ON public.chat_workflows FOR DELETE TO public USING (
  (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity logs viewable by tenant" ON public.activity_logs FOR SELECT TO public USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
CREATE POLICY "Tenant users can create activity logs" ON public.activity_logs FOR INSERT TO public WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can delete activity logs" ON public.activity_logs FOR DELETE TO public USING (
  (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);
