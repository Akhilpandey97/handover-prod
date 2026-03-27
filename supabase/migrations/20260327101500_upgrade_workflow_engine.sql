-- Upgrade chat workflows to an event-driven engine with queued execution.

ALTER TABLE public.chat_workflows
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'field_match',
  ADD COLUMN IF NOT EXISTS trigger_entity text NOT NULL DEFAULT 'project';

UPDATE public.chat_workflows
SET
  trigger_type = COALESCE(trigger_type, 'field_match'),
  trigger_entity = COALESCE(trigger_entity, 'project')
WHERE trigger_type IS NULL
   OR trigger_entity IS NULL;

ALTER TABLE public.chat_workflows
  ALTER COLUMN trigger_field DROP NOT NULL;

UPDATE public.chat_workflows
SET trigger_field = '*'
WHERE trigger_field IS NULL;

UPDATE public.chat_workflows
SET
  trigger_type = 'project_created',
  trigger_field = '*',
  trigger_value = NULL,
  action_type = CASE
    WHEN substring(coalesce(description, '') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}') IS NOT NULL THEN 'notify_email'
    ELSE 'log_activity'
  END,
  action_config = CASE
    WHEN substring(coalesce(description, '') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}') IS NOT NULL
      THEN jsonb_build_object(
        'email', substring(coalesce(description, '') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
        'subject', concat('New project created: ', coalesce(name, 'Project')),
        'message', coalesce(description, 'A workflow notification was triggered.')
      )
    ELSE jsonb_build_object(
      'message', coalesce(description, 'A workflow notification was triggered.')
    )
  END
WHERE action_type = 'notify'
  AND trigger_entity = 'project'
  AND trigger_type = 'field_match'
  AND trigger_field = 'project_state'
  AND trigger_value = 'not_started';

DROP TRIGGER IF EXISTS trg_projects_execute_chat_workflows ON public.projects;
DROP FUNCTION IF EXISTS public.handle_project_workflows();
DROP FUNCTION IF EXISTS public.execute_chat_workflow_action(public.chat_workflows, public.projects);

CREATE TABLE IF NOT EXISTS public.workflow_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid,
  event_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow events viewable by tenant"
  ON public.workflow_event_queue FOR SELECT TO public USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant users can create workflow events"
  ON public.workflow_event_queue FOR INSERT TO public WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Service role can manage workflow events"
  ON public.workflow_event_queue FOR ALL TO public USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_workflow_event_queue_tenant_status
  ON public.workflow_event_queue (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_event_queue_project
  ON public.workflow_event_queue (project_id, created_at);

CREATE TABLE IF NOT EXISTS public.workflow_event_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_event_id uuid NOT NULL REFERENCES public.workflow_event_queue(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.chat_workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_event_id, workflow_id)
);

ALTER TABLE public.workflow_event_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow runs viewable by tenant"
  ON public.workflow_event_runs FOR SELECT TO public USING (
    EXISTS (
      SELECT 1
      FROM public.workflow_event_queue q
      WHERE q.id = workflow_event_runs.queue_event_id
        AND ((q.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Service role can manage workflow runs"
  ON public.workflow_event_runs FOR ALL TO public USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_workflow_event_runs_queue
  ON public.workflow_event_runs (queue_event_id, created_at);

CREATE OR REPLACE FUNCTION public.enqueue_project_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.workflow_event_queue (
    tenant_id,
    entity_type,
    entity_id,
    project_id,
    event_type,
    old_data,
    new_data
  )
  VALUES (
    NEW.tenant_id,
    'project',
    NEW.id,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_queue_workflow_event ON public.projects;
CREATE TRIGGER trg_projects_queue_workflow_event
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_project_workflow_event();

CREATE OR REPLACE FUNCTION public.enqueue_checklist_item_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.workflow_event_queue (
    tenant_id,
    entity_type,
    entity_id,
    project_id,
    event_type,
    old_data,
    new_data
  )
  VALUES (
    NEW.tenant_id,
    'checklist_item',
    NEW.id,
    NEW.project_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_items_queue_workflow_event ON public.checklist_items;
CREATE TRIGGER trg_checklist_items_queue_workflow_event
  AFTER INSERT OR UPDATE ON public.checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_checklist_item_workflow_event();

CREATE OR REPLACE FUNCTION public.enqueue_checklist_comment_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  linked_project_id uuid;
BEGIN
  SELECT ci.project_id
  INTO linked_project_id
  FROM public.checklist_items ci
  WHERE ci.id = NEW.checklist_item_id;

  INSERT INTO public.workflow_event_queue (
    tenant_id,
    entity_type,
    entity_id,
    project_id,
    event_type,
    old_data,
    new_data
  )
  VALUES (
    NEW.tenant_id,
    'checklist_comment',
    NEW.id,
    linked_project_id,
    'created',
    NULL,
    jsonb_build_object(
      'id', NEW.id,
      'checklist_item_id', NEW.checklist_item_id,
      'comment', NEW.comment,
      'user_id', NEW.user_id,
      'user_name', NEW.user_name,
      'attachment_url', NEW.attachment_url,
      'attachment_name', NEW.attachment_name,
      'created_at', NEW.created_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_comments_queue_workflow_event ON public.checklist_comments;
CREATE TRIGGER trg_checklist_comments_queue_workflow_event
  AFTER INSERT ON public.checklist_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_checklist_comment_workflow_event();
