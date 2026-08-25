-- 1. Merchant/customer portal tokens
CREATE TABLE public.merchant_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_by uuid,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_portal_tokens TO authenticated;
GRANT ALL ON public.merchant_portal_tokens TO service_role;
ALTER TABLE public.merchant_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal tokens viewable by tenant" ON public.merchant_portal_tokens FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant users can create portal tokens" ON public.merchant_portal_tokens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant users can update portal tokens" ON public.merchant_portal_tokens FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Managers can delete portal tokens" ON public.merchant_portal_tokens FOR DELETE TO authenticated
  USING ((public.is_manager(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_portal_tokens_token ON public.merchant_portal_tokens(token);
CREATE INDEX idx_portal_tokens_project ON public.merchant_portal_tokens(project_id);

-- 2. Portal visit tracking
CREATE TABLE public.merchant_portal_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  email text,
  page text NOT NULL,
  session_id text,
  user_agent text,
  visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.merchant_portal_visits TO authenticated;
GRANT INSERT ON public.merchant_portal_visits TO anon;
GRANT ALL ON public.merchant_portal_visits TO service_role;
ALTER TABLE public.merchant_portal_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members view portal visits" ON public.merchant_portal_visits FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Anyone can insert portal visit" ON public.merchant_portal_visits FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE INDEX idx_mpv_project ON public.merchant_portal_visits(project_id);
CREATE INDEX idx_mpv_visited_at ON public.merchant_portal_visits(visited_at DESC);

-- 3. Go-live tracker support
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tracker_month text;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS is_task boolean NOT NULL DEFAULT false;

CREATE TABLE public.project_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  month text NOT NULL,
  blocker text,
  blocked_on text,
  deadline text,
  confidence text,
  pg_creds text,
  db_walkthrough text,
  csm_alignment text,
  manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ai_insights TO authenticated;
GRANT ALL ON public.project_ai_insights TO service_role;
ALTER TABLE public.project_ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read insights" ON public.project_ai_insights FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members write insights" ON public.project_ai_insights FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members update insights" ON public.project_ai_insights FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members delete insights" ON public.project_ai_insights FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER update_project_ai_insights_updated_at BEFORE UPDATE ON public.project_ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Dynamic phase rules
CREATE TABLE public.phase_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  target_phase public.project_phase NOT NULL,
  required_titles text[] NOT NULL DEFAULT '{}',
  match_mode text NOT NULL DEFAULT 'all',
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_rules TO authenticated;
GRANT ALL ON public.phase_rules TO service_role;
ALTER TABLE public.phase_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read phase rules" ON public.phase_rules FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members create phase rules" ON public.phase_rules FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members update phase rules" ON public.phase_rules FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Managers delete phase rules" ON public.phase_rules FOR DELETE TO authenticated
  USING ((public.is_manager(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER update_phase_rules_updated_at BEFORE UPDATE ON public.phase_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();