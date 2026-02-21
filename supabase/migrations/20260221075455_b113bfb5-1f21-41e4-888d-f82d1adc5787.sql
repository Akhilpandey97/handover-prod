
-- Table to track report execution history
CREATE TABLE public.report_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  recipients TEXT[] DEFAULT '{}',
  error_message TEXT,
  email_count INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Report executions viewable by tenant"
  ON public.report_executions FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can create report executions"
  ON public.report_executions FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can update report executions"
  ON public.report_executions FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can delete report executions"
  ON public.report_executions FOR DELETE
  USING ((is_manager(auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid()))) OR is_super_admin(auth.uid()));

CREATE INDEX idx_report_executions_report_id ON public.report_executions(report_id);
CREATE INDEX idx_report_executions_status ON public.report_executions(status);
