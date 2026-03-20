-- Add assigned_owner column to track which specific user owns the project
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS assigned_owner uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_assigned_owner ON public.projects(assigned_owner);