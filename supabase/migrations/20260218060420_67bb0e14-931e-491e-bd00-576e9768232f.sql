
-- Create saved_reports table for dynamic report builder
CREATE TABLE public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  columns TEXT[] NOT NULL DEFAULT '{}',
  schedule TEXT CHECK (schedule IN ('none', 'daily', 'weekly')),
  recipients TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports viewable by tenant" ON public.saved_reports
  FOR SELECT USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can create reports" ON public.saved_reports
  FOR INSERT WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can update reports" ON public.saved_reports
  FOR UPDATE USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can delete reports" ON public.saved_reports
  FOR DELETE USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));
