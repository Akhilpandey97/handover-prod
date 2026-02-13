
-- is_super_admin function (now super_admin enum value is committed)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- RLS for tenants table
CREATE POLICY "Super admins can do everything on tenants"
  ON public.tenants FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = get_user_tenant_id(auth.uid()));

-- Update RLS on profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view tenant profiles"
  ON public.profiles FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update RLS on projects
DROP POLICY IF EXISTS "Projects are viewable by authenticated users" ON public.projects;
CREATE POLICY "Projects viewable by tenant users"
  ON public.projects FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
CREATE POLICY "Tenant users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
CREATE POLICY "Tenant users can update projects"
  ON public.projects FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete projects" ON public.projects;
CREATE POLICY "Tenant users can delete projects"
  ON public.projects FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update RLS on checklist_items
DROP POLICY IF EXISTS "Checklist items viewable by authenticated users" ON public.checklist_items;
CREATE POLICY "Checklist items viewable by tenant"
  ON public.checklist_items FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create checklist items" ON public.checklist_items;
CREATE POLICY "Tenant users can create checklist items"
  ON public.checklist_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update checklist items" ON public.checklist_items;
CREATE POLICY "Tenant users can update checklist items"
  ON public.checklist_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete checklist items" ON public.checklist_items;
CREATE POLICY "Tenant users can delete checklist items"
  ON public.checklist_items FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update RLS on checklist_comments
DROP POLICY IF EXISTS "Authenticated users can view checklist comments" ON public.checklist_comments;
CREATE POLICY "Checklist comments viewable by tenant"
  ON public.checklist_comments FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create checklist comments" ON public.checklist_comments;
CREATE POLICY "Tenant users can create checklist comments"
  ON public.checklist_comments FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update RLS on checklist_responsibility_logs
DROP POLICY IF EXISTS "Checklist responsibility logs viewable by authenticated users" ON public.checklist_responsibility_logs;
CREATE POLICY "Checklist resp logs viewable by tenant"
  ON public.checklist_responsibility_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create checklist responsibility logs" ON public.checklist_responsibility_logs;
CREATE POLICY "Tenant users can create checklist resp logs"
  ON public.checklist_responsibility_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update checklist responsibility logs" ON public.checklist_responsibility_logs;
CREATE POLICY "Tenant users can update checklist resp logs"
  ON public.checklist_responsibility_logs FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete checklist responsibility logs" ON public.checklist_responsibility_logs;
CREATE POLICY "Managers can delete checklist resp logs"
  ON public.checklist_responsibility_logs FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Update RLS on project_responsibility_logs
DROP POLICY IF EXISTS "Responsibility logs viewable by authenticated users" ON public.project_responsibility_logs;
CREATE POLICY "Project resp logs viewable by tenant"
  ON public.project_responsibility_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create responsibility logs" ON public.project_responsibility_logs;
CREATE POLICY "Tenant users can create project resp logs"
  ON public.project_responsibility_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update responsibility logs" ON public.project_responsibility_logs;
CREATE POLICY "Tenant users can update project resp logs"
  ON public.project_responsibility_logs FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete project responsibility logs" ON public.project_responsibility_logs;
CREATE POLICY "Managers can delete project resp logs"
  ON public.project_responsibility_logs FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Update RLS on transfer_history
DROP POLICY IF EXISTS "Transfer history viewable by authenticated users" ON public.transfer_history;
CREATE POLICY "Transfer history viewable by tenant"
  ON public.transfer_history FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create transfer records" ON public.transfer_history;
CREATE POLICY "Tenant users can create transfer records"
  ON public.transfer_history FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update transfer records" ON public.transfer_history;
CREATE POLICY "Tenant users can update transfer records"
  ON public.transfer_history FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete transfer records" ON public.transfer_history;
CREATE POLICY "Managers can delete transfer records"
  ON public.transfer_history FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Update RLS on app_settings
DROP POLICY IF EXISTS "Settings are readable by all authenticated users" ON public.app_settings;
CREATE POLICY "Settings readable by tenant"
  ON public.app_settings FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can insert settings" ON public.app_settings;
CREATE POLICY "Managers can insert tenant settings"
  ON public.app_settings FOR INSERT
  WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can update settings" ON public.app_settings;
CREATE POLICY "Managers can update tenant settings"
  ON public.app_settings FOR UPDATE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Update RLS on user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view all roles" ON public.user_roles;
CREATE POLICY "Managers view tenant roles"
  ON public.user_roles FOR SELECT
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can insert roles" ON public.user_roles;
CREATE POLICY "Managers insert tenant roles"
  ON public.user_roles FOR INSERT
  WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can update roles" ON public.user_roles;
CREATE POLICY "Managers update tenant roles"
  ON public.user_roles FOR UPDATE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete roles" ON public.user_roles;
CREATE POLICY "Managers delete tenant roles"
  ON public.user_roles FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Update checklist_comments delete policy
DROP POLICY IF EXISTS "Authenticated users can delete their own comments" ON public.checklist_comments;
CREATE POLICY "Users can delete own comments in tenant"
  ON public.checklist_comments FOR DELETE
  USING (
    (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()))
    OR (is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
    OR is_super_admin(auth.uid())
  );
