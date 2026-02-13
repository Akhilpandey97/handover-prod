
-- Create app_settings table for storing global editable labels/config
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings are readable by all authenticated users"
  ON public.app_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only managers can update settings
CREATE POLICY "Managers can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Managers can update settings"
  ON public.app_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
  );

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default labels
INSERT INTO public.app_settings (key, value, category) VALUES
  -- General
  ('app_title', 'Manager Dashboard', 'general'),
  ('app_subtitle', 'Project Management Hub', 'general'),
  ('org_name', 'GoKwik', 'general'),
  
  -- Team labels
  ('team_mint', 'MINT (Presales)', 'teams'),
  ('team_integration', 'Integration Team', 'teams'),
  ('team_ms', 'MS (Merchant Success)', 'teams'),
  ('team_manager', 'Manager', 'teams'),
  
  -- Responsibility labels
  ('responsibility_internal', 'GoKwik', 'responsibility'),
  ('responsibility_external', 'Merchant', 'responsibility'),
  ('responsibility_neutral', 'Neutral', 'responsibility'),
  
  -- Phase labels
  ('phase_mint', 'MINT', 'phases'),
  ('phase_integration', 'Integration', 'phases'),
  ('phase_ms', 'MS', 'phases'),
  ('phase_completed', 'Completed', 'phases'),
  
  -- State labels
  ('state_not_started', 'Not Started', 'states'),
  ('state_on_hold', 'On-Hold', 'states'),
  ('state_in_progress', 'In Progress', 'states'),
  ('state_live', 'Live', 'states'),
  ('state_blocked', 'Blocked', 'states'),
  
  -- Field labels
  ('field_merchant_name', 'Merchant Name', 'fields'),
  ('field_mid', 'MID', 'fields'),
  ('field_kick_off_date', 'Start Date (Kick Off)', 'fields'),
  ('field_go_live_date', 'Go-Live Date', 'fields'),
  ('field_arr', 'ARR', 'fields'),
  ('field_platform', 'Platform', 'fields'),
  ('field_integration_type', 'Integration Type', 'fields'),
  ('field_sales_spoc', 'Sales SPOC', 'fields'),
  ('field_assigned_owner', 'Assigned Owner', 'fields'),
  ('field_project_notes', 'Project Notes', 'fields')
ON CONFLICT (key) DO NOTHING;
