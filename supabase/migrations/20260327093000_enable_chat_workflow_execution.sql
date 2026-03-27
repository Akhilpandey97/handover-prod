-- Keep workflow metadata fresh and make saved chat workflows execute on project changes.
CREATE INDEX IF NOT EXISTS idx_chat_workflows_active_lookup
  ON public.chat_workflows (tenant_id, is_active, trigger_field, created_at DESC);

DROP TRIGGER IF EXISTS update_chat_workflows_updated_at ON public.chat_workflows;
CREATE TRIGGER update_chat_workflows_updated_at
  BEFORE UPDATE ON public.chat_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.execute_chat_workflow_action(
  workflow_row public.chat_workflows,
  project_row public.projects
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  affected_rows integer := 0;
  target_field text;
  target_value text;
  target_owner_id uuid;
  target_owner_name text;
  notify_message text;
BEGIN
  IF workflow_row.action_type = 'assign_owner' THEN
    target_owner_id := nullif(workflow_row.action_config->>'owner_id', '')::uuid;
    target_owner_name := nullif(workflow_row.action_config->>'owner_name', '');

    IF target_owner_id IS NULL THEN
      RETURN;
    END IF;

    UPDATE public.projects
    SET assigned_owner = target_owner_id
    WHERE id = project_row.id
      AND tenant_id = project_row.tenant_id
      AND assigned_owner IS DISTINCT FROM target_owner_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows > 0 THEN
      INSERT INTO public.activity_logs (
        tenant_id,
        action,
        entity_type,
        entity_id,
        entity_name,
        user_name,
        details
      )
      VALUES (
        project_row.tenant_id,
        'workflow_assign_owner',
        'project',
        project_row.id::text,
        project_row.merchant_name,
        'AI Assistant',
        jsonb_build_object(
          'workflow_id', workflow_row.id,
          'workflow_name', workflow_row.name,
          'owner_id', target_owner_id,
          'owner_name', target_owner_name
        )
      );
    END IF;

    RETURN;
  END IF;

  IF workflow_row.action_type = 'update_field' THEN
    target_field := workflow_row.action_config->>'field';
    target_value := workflow_row.action_config->>'value';

    IF target_field IS NULL OR target_value IS NULL THEN
      RETURN;
    END IF;

    CASE target_field
      WHEN 'project_state' THEN
        UPDATE public.projects
        SET project_state = target_value::public.project_state
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND project_state IS DISTINCT FROM target_value::public.project_state;
      WHEN 'current_phase' THEN
        UPDATE public.projects
        SET current_phase = target_value::public.project_phase
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND current_phase IS DISTINCT FROM target_value::public.project_phase;
      WHEN 'platform' THEN
        UPDATE public.projects
        SET platform = target_value
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND platform IS DISTINCT FROM target_value;
      WHEN 'category' THEN
        UPDATE public.projects
        SET category = target_value
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND category IS DISTINCT FROM target_value;
      WHEN 'sales_spoc' THEN
        UPDATE public.projects
        SET sales_spoc = target_value
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND sales_spoc IS DISTINCT FROM target_value;
      WHEN 'project_notes' THEN
        UPDATE public.projects
        SET project_notes = target_value
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND project_notes IS DISTINCT FROM target_value;
      WHEN 'current_phase_comment' THEN
        UPDATE public.projects
        SET current_phase_comment = target_value
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND current_phase_comment IS DISTINCT FROM target_value;
      WHEN 'current_responsibility' THEN
        UPDATE public.projects
        SET current_responsibility = target_value::public.responsibility_party
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND current_responsibility IS DISTINCT FROM target_value::public.responsibility_party;
      WHEN 'expected_go_live_date' THEN
        UPDATE public.projects
        SET expected_go_live_date = target_value::date
        WHERE id = project_row.id
          AND tenant_id = project_row.tenant_id
          AND expected_go_live_date IS DISTINCT FROM target_value::date;
      ELSE
        INSERT INTO public.activity_logs (
          tenant_id,
          action,
          entity_type,
          entity_id,
          entity_name,
          user_name,
          details
        )
        VALUES (
          project_row.tenant_id,
          'workflow_error',
          'workflow',
          workflow_row.id::text,
          workflow_row.name,
          'AI Assistant',
          jsonb_build_object(
            'error', 'Unsupported update_field target',
            'field', target_field
          )
        );
        RETURN;
    END CASE;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows > 0 THEN
      INSERT INTO public.activity_logs (
        tenant_id,
        action,
        entity_type,
        entity_id,
        entity_name,
        user_name,
        details
      )
      VALUES (
        project_row.tenant_id,
        'workflow_update_field',
        'project',
        project_row.id::text,
        project_row.merchant_name,
        'AI Assistant',
        jsonb_build_object(
          'workflow_id', workflow_row.id,
          'workflow_name', workflow_row.name,
          'field', target_field,
          'value', target_value
        )
      );
    END IF;

    RETURN;
  END IF;

  IF workflow_row.action_type = 'notify' THEN
    notify_message := coalesce(
      nullif(workflow_row.action_config->>'message', ''),
      workflow_row.description,
      format('Workflow "%s" triggered for %s.', workflow_row.name, project_row.merchant_name)
    );

    INSERT INTO public.activity_logs (
      tenant_id,
      action,
      entity_type,
      entity_id,
      entity_name,
      user_name,
      details
    )
    VALUES (
      project_row.tenant_id,
      'workflow_notify',
      'project',
      project_row.id::text,
      project_row.merchant_name,
      'AI Assistant',
      jsonb_build_object(
        'workflow_id', workflow_row.id,
        'workflow_name', workflow_row.name,
        'message', notify_message
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_project_workflows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  workflow_row public.chat_workflows%ROWTYPE;
  new_value text;
  old_value text;
BEGIN
  IF NEW.tenant_id IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  FOR workflow_row IN
    SELECT *
    FROM public.chat_workflows
    WHERE tenant_id = NEW.tenant_id
      AND is_active = true
  LOOP
    new_value := to_jsonb(NEW)->>workflow_row.trigger_field;

    IF new_value IS NULL THEN
      CONTINUE;
    END IF;

    IF workflow_row.trigger_value IS NOT NULL
       AND workflow_row.trigger_value IS DISTINCT FROM new_value THEN
      CONTINUE;
    END IF;

    old_value := CASE
      WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)->>workflow_row.trigger_field
      ELSE NULL
    END;

    IF TG_OP = 'UPDATE' AND old_value IS NOT DISTINCT FROM new_value THEN
      CONTINUE;
    END IF;

    PERFORM public.execute_chat_workflow_action(workflow_row, NEW);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_execute_chat_workflows ON public.projects;
CREATE TRIGGER trg_projects_execute_chat_workflows
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_workflows();
