
-- Create project_state enum
CREATE TYPE public.project_state AS ENUM ('not_started', 'on_hold', 'in_progress', 'live', 'blocked');

-- Add project_state column to projects table
ALTER TABLE public.projects ADD COLUMN project_state public.project_state DEFAULT 'not_started';
