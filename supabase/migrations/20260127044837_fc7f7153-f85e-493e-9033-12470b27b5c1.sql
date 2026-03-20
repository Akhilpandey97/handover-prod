-- Create ENUM types for team roles and responsibility parties
CREATE TYPE team_role AS ENUM ('mint', 'integration', 'ms', 'manager');
CREATE TYPE responsibility_party AS ENUM ('gokwik', 'merchant', 'neutral');
CREATE TYPE project_phase AS ENUM ('mint', 'integration', 'ms', 'completed');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  team team_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name TEXT NOT NULL,
  mid TEXT NOT NULL,
  platform TEXT DEFAULT 'Custom',
  arr DECIMAL(10, 2) DEFAULT 0,
  txns_per_day INTEGER DEFAULT 0,
  aov DECIMAL(10, 2) DEFAULT 0,
  category TEXT,
  current_phase project_phase DEFAULT 'mint',
  current_owner_team team_role DEFAULT 'mint',
  pending_acceptance BOOLEAN DEFAULT FALSE,
  go_live_percent INTEGER DEFAULT 0,
  brand_url TEXT,
  jira_link TEXT,
  brd_link TEXT,
  mint_checklist_link TEXT,
  integration_checklist_link TEXT,
  kick_off_date DATE NOT NULL,
  go_live_date DATE,
  expected_go_live_date DATE,
  mint_notes TEXT,
  project_notes TEXT,
  current_phase_comment TEXT,
  phase2_comment TEXT,
  sales_spoc TEXT,
  integration_type TEXT DEFAULT 'Standard',
  pg_onboarding TEXT,
  current_responsibility responsibility_party DEFAULT 'neutral',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create checklist items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  phase project_phase NOT NULL,
  owner_team team_role NOT NULL,
  current_responsibility responsibility_party DEFAULT 'neutral',
  comment TEXT,
  comment_by TEXT,
  comment_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create responsibility logs for projects
CREATE TABLE public.project_responsibility_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  party responsibility_party NOT NULL,
  phase project_phase NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create responsibility logs for checklist items
CREATE TABLE public.checklist_responsibility_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID REFERENCES public.checklist_items(id) ON DELETE CASCADE NOT NULL,
  party responsibility_party NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transfer history table
CREATE TABLE public.transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  from_team team_role NOT NULL,
  to_team team_role NOT NULL,
  transferred_by TEXT NOT NULL,
  accepted_by TEXT,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_responsibility_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responsibility_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- RLS Policies for projects (all authenticated users can CRUD for now, team-based logic in app)
CREATE POLICY "Projects are viewable by authenticated users" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for checklist_items
CREATE POLICY "Checklist items viewable by authenticated users" ON public.checklist_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create checklist items" ON public.checklist_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklist items" ON public.checklist_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete checklist items" ON public.checklist_items
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for project_responsibility_logs
CREATE POLICY "Responsibility logs viewable by authenticated users" ON public.project_responsibility_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create responsibility logs" ON public.project_responsibility_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update responsibility logs" ON public.project_responsibility_logs
  FOR UPDATE TO authenticated USING (true);

-- RLS Policies for checklist_responsibility_logs
CREATE POLICY "Checklist responsibility logs viewable by authenticated users" ON public.checklist_responsibility_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create checklist responsibility logs" ON public.checklist_responsibility_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklist responsibility logs" ON public.checklist_responsibility_logs
  FOR UPDATE TO authenticated USING (true);

-- RLS Policies for transfer_history
CREATE POLICY "Transfer history viewable by authenticated users" ON public.transfer_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create transfer records" ON public.transfer_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfer records" ON public.transfer_history
  FOR UPDATE TO authenticated USING (true);

-- Create indexes for better performance
CREATE INDEX idx_projects_owner_team ON public.projects(current_owner_team);
CREATE INDEX idx_projects_phase ON public.projects(current_phase);
CREATE INDEX idx_checklist_project ON public.checklist_items(project_id);
CREATE INDEX idx_project_resp_logs_project ON public.project_responsibility_logs(project_id);
CREATE INDEX idx_checklist_resp_logs_item ON public.checklist_responsibility_logs(checklist_item_id);
CREATE INDEX idx_transfer_history_project ON public.transfer_history(project_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, team)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'team')::team_role, 'mint')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();