
-- Allow managers to delete checklist_responsibility_logs
CREATE POLICY "Managers can delete checklist responsibility logs"
ON public.checklist_responsibility_logs
FOR DELETE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'manager'));

-- Allow managers to delete transfer_history
CREATE POLICY "Managers can delete transfer records"
ON public.transfer_history
FOR DELETE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'manager'));

-- Allow managers to delete project_responsibility_logs
CREATE POLICY "Managers can delete project responsibility logs"
ON public.project_responsibility_logs
FOR DELETE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'manager'));
