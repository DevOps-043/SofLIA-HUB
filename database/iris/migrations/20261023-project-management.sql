-- Instancia: IRIS. Precondición: esquema de Project Hub verificado el 2026-10-23.
-- Impacto: operaciones atómicas exclusivas del servidor; no altera datos existentes.
-- Idempotencia: CREATE OR REPLACE. No habilita acceso directo desde el renderer.
-- Aplicación remota pendiente de autorización. Rollback: archivo homónimo .rollback.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.hub_create_team_v1(p_workspace_id uuid, p_actor_id uuid, p_name text, p_description text, p_visibility text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE t public.teams;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND is_active AND iris_role IN ('owner','admin')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF length(trim(p_name)) NOT BETWEEN 1 AND 255 OR p_visibility NOT IN ('public','private','internal') THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  INSERT INTO teams(name,slug,description,visibility,owner_id,workspace_id)
    VALUES(trim(p_name),'equipo-'||gen_random_uuid(),p_description,p_visibility,p_actor_id,p_workspace_id) RETURNING * INTO t;
  INSERT INTO team_members(team_id,user_id,role,invited_by) VALUES(t.team_id,p_actor_id,'owner',p_actor_id);
  INSERT INTO task_statuses(team_id,name,status_type,position,is_default,is_closed) VALUES
    (t.team_id,'Por hacer','todo',0,true,false),(t.team_id,'En curso','in_progress',1,false,false),
    (t.team_id,'En revisión','in_review',2,false,false),(t.team_id,'Completada','done',3,false,true),(t.team_id,'Cancelada','cancelled',4,false,true);
  RETURN to_jsonb(t);
END $$;

CREATE OR REPLACE FUNCTION public.hub_assign_project_team_v1(p_workspace_id uuid,p_project_id uuid,p_team_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE p public.pm_projects;
BEGIN
  SELECT * INTO p FROM pm_projects WHERE project_id=p_project_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_expected_updated_at IS NOT NULL AND p.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
  IF p.team_id IS DISTINCT FROM p_team_id AND EXISTS(SELECT 1 FROM task_issues WHERE project_id=p_project_id) THEN RAISE EXCEPTION 'PROJECT_HAS_TASKS'; END IF;
  PERFORM 1 FROM teams WHERE team_id=p_team_id AND workspace_id=p_workspace_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  UPDATE pm_projects SET team_id=p_team_id,updated_at=clock_timestamp() WHERE project_id=p_project_id RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;

CREATE OR REPLACE FUNCTION public.hub_manage_team_member_v1(p_workspace_id uuid,p_team_id uuid,p_actor_id uuid,p_operation text,p_user_id uuid,p_member_id uuid,p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE t public.teams; m public.team_members; total integer;
BEGIN
  SELECT * INTO t FROM teams WHERE team_id=p_team_id AND workspace_id=p_workspace_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND is_active) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF t.owner_id<>p_actor_id AND NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND is_active AND iris_role IN ('owner','admin')) AND NOT EXISTS(SELECT 1 FROM team_members WHERE team_id=p_team_id AND user_id=p_actor_id AND is_active AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_operation NOT IN ('addTeamMember','updateTeamMember','removeTeamMember') OR (p_operation<>'removeTeamMember' AND p_role NOT IN ('admin','moderator','member','viewer')) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  IF p_operation='addTeamMember' THEN
    IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_user_id AND is_active) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    SELECT * INTO m FROM team_members WHERE team_id=p_team_id AND user_id=p_user_id FOR UPDATE;
  ELSE
    SELECT * INTO m FROM team_members WHERE team_id=p_team_id AND member_id=p_member_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;
  IF m.role='owner' OR m.user_id=t.owner_id OR p_user_id=t.owner_id THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
  IF p_operation='addTeamMember' THEN
    IF m.member_id IS NOT NULL AND m.is_active THEN RAISE EXCEPTION 'MEMBER_EXISTS'; END IF;
    SELECT count(*) INTO total FROM team_members WHERE team_id=p_team_id AND is_active;
    IF t.max_members IS NOT NULL AND total>=t.max_members THEN RAISE EXCEPTION 'TEAM_FULL'; END IF;
    IF m.member_id IS NULL THEN
      INSERT INTO team_members(team_id,user_id,role,invited_by) VALUES(p_team_id,p_user_id,p_role,p_actor_id) RETURNING * INTO m;
    ELSE
      UPDATE team_members SET role=p_role,is_active=true,invited_by=p_actor_id,updated_at=clock_timestamp() WHERE member_id=m.member_id RETURNING * INTO m;
    END IF;
  ELSIF p_operation='updateTeamMember' THEN
    UPDATE team_members SET role=p_role,updated_at=clock_timestamp() WHERE member_id=m.member_id RETURNING * INTO m;
  ELSE
    UPDATE team_members SET is_active=false,updated_at=clock_timestamp() WHERE member_id=m.member_id RETURNING * INTO m;
  END IF;
  RETURN to_jsonb(m);
END $$;

CREATE OR REPLACE FUNCTION public.hub_mutate_task_v1(p_workspace_id uuid,p_project_id uuid,p_actor_id uuid,p_task_id uuid,p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE p public.pm_projects; t public.task_issues; previous public.task_issues; field text; label uuid; st public.task_statuses; next_number integer; parent uuid; visited uuid[]; evidence uuid; evidence_item uuid;
BEGIN
  -- Mismo orden de bloqueos que la asignación de equipo. Serializa también las jerarquías.
  SELECT * INTO p FROM pm_projects WHERE project_id=p_project_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND OR p.team_id IS NULL THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  PERFORM 1 FROM teams WHERE team_id=p.team_id AND workspace_id=p_workspace_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND is_active) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND is_active AND iris_role IN ('owner','admin')) AND NOT EXISTS(SELECT 1 FROM pm_project_members WHERE project_id=p_project_id AND user_id=p_actor_id AND membership_status='active' AND project_role IN ('owner','admin','member')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_task_id IS NULL THEN
    t := jsonb_populate_record(NULL::public.task_issues,p_changes - ARRAY['issue_id','project_id','team_id','creator_id','issue_number','archived_at','created_at','updated_at','description_html','completed_at','cancelled_at']);
    IF t.title IS NULL OR length(trim(t.title)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    IF t.status_id IS NULL THEN SELECT status_id INTO t.status_id FROM task_statuses WHERE team_id=p.team_id AND NOT is_closed ORDER BY is_default DESC,position LIMIT 1; END IF;
  ELSE
    SELECT * INTO t FROM task_issues WHERE issue_id=p_task_id AND project_id=p_project_id AND archived_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    previous:=t;
    IF p_changes ? 'expected_updated_at' AND t.updated_at IS DISTINCT FROM (p_changes->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
    t := jsonb_populate_record(t,p_changes - ARRAY['issue_id','project_id','team_id','creator_id','issue_number','archived_at','created_at','updated_at','description_html','completed_at','cancelled_at']);
  END IF;
  SELECT * INTO st FROM task_statuses WHERE status_id=t.status_id AND team_id=p.team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  IF t.priority_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM task_priorities WHERE priority_id=t.priority_id) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  IF t.cycle_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM task_cycles WHERE cycle_id=t.cycle_id AND team_id=p.team_id) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  IF t.assignee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pm_project_members pm JOIN workspace_members wm ON wm.user_id=pm.user_id AND wm.workspace_id=p_workspace_id AND wm.is_active WHERE pm.project_id=p_project_id AND pm.user_id=t.assignee_id AND pm.membership_status='active') THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  parent:=t.parent_issue_id; visited:=ARRAY[coalesce(p_task_id,gen_random_uuid())];
  WHILE parent IS NOT NULL LOOP
    IF parent=ANY(visited) OR cardinality(visited)>50 THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    visited:=array_append(visited,parent);
    SELECT parent_issue_id INTO parent FROM task_issues WHERE issue_id=parent AND project_id=p_project_id AND team_id=p.team_id AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  END LOOP;
  IF p_task_id IS NULL THEN
    SELECT coalesce(max(issue_number),0)+1 INTO next_number FROM task_issues WHERE team_id=p.team_id;
    INSERT INTO task_issues(team_id,issue_number,project_id,creator_id,title,description,status_id,priority_id,assignee_id,due_date,cycle_id,parent_issue_id,estimate_points,estimate_hours,completed_at,cancelled_at)
      VALUES(p.team_id,next_number,p_project_id,p_actor_id,trim(t.title),t.description,t.status_id,t.priority_id,t.assignee_id,t.due_date,t.cycle_id,t.parent_issue_id,t.estimate_points,t.estimate_hours,CASE WHEN st.status_type='done' THEN clock_timestamp() END,CASE WHEN st.status_type='cancelled' THEN clock_timestamp() END) RETURNING * INTO t;
    evidence:=(p_changes->>'evidence_id')::uuid; evidence_item:=(p_changes->>'evidence_item_id')::uuid;
    IF evidence IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM pm_project_evidence WHERE evidence_id=evidence AND project_id=p_project_id AND workspace_id=p_workspace_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
      IF evidence_item IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pm_project_evidence_items WHERE item_id=evidence_item AND evidence_id=evidence) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
      INSERT INTO task_issue_evidence(issue_id,evidence_id,evidence_item_id,relation_type,created_by_user_id) VALUES(t.issue_id,evidence,evidence_item,'supports',p_actor_id);
    ELSIF evidence_item IS NOT NULL THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  ELSE
    UPDATE task_issues SET title=t.title,description=t.description,description_html=CASE WHEN p_changes ? 'description' THEN NULL ELSE t.description_html END,status_id=t.status_id,priority_id=t.priority_id,assignee_id=t.assignee_id,due_date=t.due_date,cycle_id=t.cycle_id,parent_issue_id=t.parent_issue_id,estimate_points=t.estimate_points,estimate_hours=t.estimate_hours,
      completed_at=CASE WHEN st.status_type='done' THEN coalesce(t.completed_at,clock_timestamp()) END,cancelled_at=CASE WHEN st.status_type='cancelled' THEN coalesce(t.cancelled_at,clock_timestamp()) END,updated_at=clock_timestamp()
      WHERE issue_id=p_task_id RETURNING * INTO t;
  END IF;
  IF p_changes ? 'label_ids' THEN
    FOR label IN SELECT jsonb_array_elements_text(p_changes->'label_ids')::uuid LOOP
      IF NOT EXISTS(SELECT 1 FROM task_labels WHERE label_id=label AND team_id=p.team_id) THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    END LOOP;
    DELETE FROM task_issue_labels WHERE issue_id=t.issue_id;
    INSERT INTO task_issue_labels(issue_id,label_id) SELECT t.issue_id,value::uuid FROM jsonb_array_elements_text(p_changes->'label_ids') AS labels(value) GROUP BY value;
    INSERT INTO task_issue_history(issue_id,actor_id,field_name,new_value) VALUES(t.issue_id,p_actor_id,'labels','Etiquetas actualizadas');
  END IF;
  IF p_task_id IS NULL THEN
    INSERT INTO task_issue_history(issue_id,actor_id,field_name,new_value) VALUES(t.issue_id,p_actor_id,'created','Tarea creada');
  ELSE
    FOREACH field IN ARRAY ARRAY['title','description','status_id','priority_id','assignee_id','due_date','cycle_id','parent_issue_id','estimate_points','estimate_hours'] LOOP
      IF (to_jsonb(previous)->field) IS DISTINCT FROM (to_jsonb(t)->field) THEN INSERT INTO task_issue_history(issue_id,actor_id,field_name,old_value,new_value) VALUES(t.issue_id,p_actor_id,field,to_jsonb(previous)->>field,to_jsonb(t)->>field); END IF;
    END LOOP;
  END IF;
  RETURN to_jsonb(t);
END $$;


CREATE OR REPLACE FUNCTION public.hub_archive_task_v1(p_workspace_id uuid,p_project_id uuid,p_task_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $function$
DECLARE t public.task_issues;
BEGIN
  PERFORM 1 FROM pm_projects WHERE project_id=p_project_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO t FROM task_issues WHERE issue_id=p_task_id AND project_id=p_project_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_expected_updated_at IS NOT NULL AND t.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM task_issues WHERE parent_issue_id=p_task_id AND project_id=p_project_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'TASK_HAS_CHILDREN'; END IF;
  UPDATE task_issues SET archived_at=clock_timestamp(),updated_at=clock_timestamp() WHERE issue_id=p_task_id RETURNING * INTO t;
  RETURN to_jsonb(t);
END $function$;
REVOKE ALL ON FUNCTION public.hub_archive_task_v1(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hub_archive_task_v1(uuid,uuid,uuid,timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.hub_create_team_v1(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hub_assign_project_team_v1(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hub_manage_team_member_v1(uuid,uuid,uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hub_mutate_task_v1(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hub_create_team_v1(uuid,uuid,text,text,text),public.hub_assign_project_team_v1(uuid,uuid,uuid,timestamptz),public.hub_manage_team_member_v1(uuid,uuid,uuid,text,uuid,uuid,text),public.hub_mutate_task_v1(uuid,uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;
