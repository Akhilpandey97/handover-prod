CREATE TABLE public.movement_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  timeframe text NOT NULL DEFAULT 'daily',
  days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  time_ist text NOT NULL DEFAULT '09:00',
  recipients text[] NOT NULL DEFAULT '{}',
  subject_prefix text,
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_report_schedules TO authenticated;
GRANT ALL ON public.movement_report_schedules TO service_role;
ALTER TABLE public.movement_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view movement schedules"
  ON public.movement_report_schedules FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members can create movement schedules"
  ON public.movement_report_schedules FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members can update movement schedules"
  ON public.movement_report_schedules FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant members can delete movement schedules"
  ON public.movement_report_schedules FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_movement_report_schedules_updated_at
  BEFORE UPDATE ON public.movement_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.movement_report_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.movement_report_schedules(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  status text NOT NULL DEFAULT 'sending',
  recipients text[],
  email_count integer,
  error_message text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.movement_report_executions TO authenticated;
GRANT ALL ON public.movement_report_executions TO service_role;
ALTER TABLE public.movement_report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view movement executions"
  ON public.movement_report_executions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));