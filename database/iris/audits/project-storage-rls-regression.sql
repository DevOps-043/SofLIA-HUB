-- IRIS. Prueba controlada autorizada el 2026-10-24. Todos los fixtures se revierten.
-- Simula sólo el contexto ya verificado; la red/sesión se verifica por separado.
BEGIN;
DO $$
DECLARE owner_id uuid := gen_random_uuid(); viewer_id uuid := gen_random_uuid();
  editor_user_id uuid := gen_random_uuid(); org_a uuid := gen_random_uuid(); org_b uuid := gen_random_uuid();
  ws_a uuid; ws_b uuid := gen_random_uuid(); p_a uuid; p_b uuid := gen_random_uuid();
  e uuid; d uuid; n integer;
BEGIN
  PERFORM set_config('soflia.verified_scope', jsonb_build_object('user_id',owner_id,'organization_id',org_a,'role','member')::text,true);
  PERFORM set_config('role','anon',true);
  INSERT INTO public.account_users(user_id,sofia_user_id,first_name,last_name_paternal,username,email,password_hash)
    VALUES(owner_id,owner_id,'Prueba','Temporal','qa_'||replace(owner_id::text,'-',''),owner_id||'@example.invalid','SOFIA_MANAGED_AUTH');
  IF hub_private.actor_v1() IS DISTINCT FROM owner_id THEN RAISE EXCEPTION 'Fallo: alta propia'; END IF;
  INSERT INTO public.workspaces(sofia_org_id,name,slug,is_active)
    VALUES(org_a,'Prueba temporal','qa-'||org_a,true) RETURNING workspace_id INTO ws_a;
  INSERT INTO public.workspace_members(workspace_id,user_id,sofia_role,iris_role,is_active)
    VALUES(ws_a,owner_id,'member','member',true);
  INSERT INTO public.pm_projects(workspace_id,project_key,project_name,created_by_user_id)
    VALUES(ws_a,'QA-'||gen_random_uuid(),'Prueba temporal',owner_id) RETURNING project_id INTO p_a;
  INSERT INTO public.pm_project_evidence(workspace_id,project_id,evidence_type,source_system,title,metadata,created_by_user_id)
    VALUES(ws_a,p_a,'link','soflia-browser','Marcador temporal','{"url":"https://example.invalid/qa"}',owner_id) RETURNING evidence_id INTO e;
  IF NOT EXISTS(SELECT 1 FROM public.pm_project_evidence WHERE evidence_id=e) THEN RAISE EXCEPTION 'Fallo: guardar y releer'; END IF;
  INSERT INTO public.pm_project_documents(project_id,name,provider,external_id,external_url,created_by)
    VALUES(p_a,'Documento temporal','google_drive','qa-temporal','https://example.invalid/qa',owner_id) RETURNING id INTO d;
  INSERT INTO public.pm_project_evidence_items(evidence_id,item_type,content) VALUES(e,'excerpt','Texto temporal');

  PERFORM set_config('role','none',true);
  INSERT INTO public.account_users(user_id,sofia_user_id,first_name,last_name_paternal,username,email,password_hash)
    SELECT v,v,'Prueba','Temporal','qa_'||replace(v::text,'-',''),v||'@example.invalid','SOFIA_MANAGED_AUTH'
      FROM unnest(ARRAY[viewer_id,editor_user_id]) v;
  INSERT INTO public.workspace_members(workspace_id,user_id,sofia_role,iris_role,is_active)
    VALUES(ws_a,viewer_id,'member','admin',true),(ws_a,editor_user_id,'member','member',true);
  INSERT INTO public.pm_project_members(project_id,user_id,project_role)
    VALUES(p_a,viewer_id,'viewer'),(p_a,editor_user_id,'member');
  INSERT INTO public.workspaces(workspace_id,sofia_org_id,name,slug,is_active)
    VALUES(ws_b,org_b,'Otra organización temporal','qa-'||org_b,true);
  INSERT INTO public.workspace_members(workspace_id,user_id,sofia_role,iris_role,is_active)
    VALUES(ws_b,owner_id,'owner','owner',true);
  INSERT INTO public.pm_projects(project_id,workspace_id,project_key,project_name,created_by_user_id)
    VALUES(p_b,ws_b,'QA-'||gen_random_uuid(),'Otro proyecto temporal',owner_id);
  PERFORM set_config('role','anon',true);
  INSERT INTO public.pm_project_members(project_id,user_id,project_role,invited_by_user_id)
    VALUES(p_a,editor_user_id,'member',owner_id)
    ON CONFLICT(project_id,user_id) DO UPDATE SET project_role=excluded.project_role,invited_by_user_id=excluded.invited_by_user_id;
  BEGIN
    UPDATE public.pm_project_documents SET created_by=viewer_id WHERE id=d;
    RAISE EXCEPTION 'Fallo: autor del documento modificado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('soflia.verified_scope',jsonb_build_object('user_id',viewer_id,'organization_id',org_a,'role','member')::text,true);
  PERFORM set_config('role','anon',true);
  IF NOT EXISTS(SELECT 1 FROM public.pm_project_evidence WHERE evidence_id=e) THEN RAISE EXCEPTION 'Fallo: lectura del lector'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pm_project_evidence_items WHERE evidence_id=e) THEN RAISE EXCEPTION 'Fallo: lectura de elementos'; END IF;
  BEGIN
    INSERT INTO public.pm_project_evidence(workspace_id,project_id,evidence_type,source_system,title,created_by_user_id)
      VALUES(ws_a,p_a,'link','soflia-browser','No permitido',viewer_id);
    RAISE EXCEPTION 'Fallo: el lector escribió';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.pm_project_documents SET name='No permitido' WHERE id=d;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Fallo: el lector editó'; END IF;
  DELETE FROM public.pm_project_documents WHERE id=d;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Fallo: el lector borró'; END IF;
  BEGIN
    UPDATE public.workspace_members SET iris_role='owner' WHERE workspace_id=ws_a AND user_id=viewer_id;
    RAISE EXCEPTION 'Fallo: elevación de rol';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('soflia.verified_scope',jsonb_build_object('user_id',editor_user_id,'organization_id',org_a,'role','member')::text,true);
  INSERT INTO public.pm_project_evidence(workspace_id,project_id,evidence_type,source_system,title,created_by_user_id)
    VALUES(ws_a,p_a,'link','soflia-browser','Miembro temporal',editor_user_id);
  BEGIN
    INSERT INTO public.pm_project_evidence(workspace_id,project_id,evidence_type,source_system,title,created_by_user_id)
      VALUES(ws_a,p_a,'link','soflia-browser','Actor falso',owner_id);
    RAISE EXCEPTION 'Fallo: actor falsificado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.pm_projects SET created_by_user_id=editor_user_id WHERE project_id=p_a;
    RAISE EXCEPTION 'Fallo: propiedad modificada';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.pm_projects WHERE project_id=p_b) THEN RAISE EXCEPTION 'Fallo: lectura entre organizaciones'; END IF;

  PERFORM set_config('soflia.verified_scope',jsonb_build_object('user_id',owner_id,'organization_id',org_b,'role','owner')::text,true);
  IF EXISTS(SELECT 1 FROM public.pm_project_evidence WHERE evidence_id=e) THEN RAISE EXCEPTION 'Fallo: propietario con organización equivocada'; END IF;
  BEGIN
    INSERT INTO public.pm_project_evidence(workspace_id,project_id,evidence_type,source_system,title,created_by_user_id)
      VALUES(ws_a,p_a,'link','soflia-browser','Organización equivocada',owner_id);
    RAISE EXCEPTION 'Fallo: escritura entre organizaciones';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('role','none',true);
  UPDATE public.workspace_members SET is_active=false WHERE workspace_id=ws_a AND user_id=editor_user_id;
  PERFORM set_config('soflia.verified_scope',jsonb_build_object('user_id',editor_user_id,'organization_id',org_a,'role','member')::text,true);
  PERFORM set_config('role','anon',true);
  IF EXISTS(SELECT 1 FROM public.pm_project_evidence WHERE evidence_id=e) THEN RAISE EXCEPTION 'Fallo: miembro desactivado'; END IF;

  PERFORM set_config('soflia.verified_scope','',true);
  IF EXISTS(SELECT 1 FROM public.pm_projects) OR EXISTS(SELECT 1 FROM public.pm_project_evidence)
    OR EXISTS(SELECT 1 FROM public.pm_project_documents) THEN RAISE EXCEPTION 'Fallo: acceso sin sesión'; END IF;
  BEGIN
    PERFORM password_hash FROM public.account_users LIMIT 1;
    RAISE EXCEPTION 'Fallo: hash expuesto';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('role','none',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
  PERFORM set_config('role','authenticated',true);
  IF EXISTS(SELECT 1 FROM public.pm_projects) THEN RAISE EXCEPTION 'Fallo: claims sin verificación'; END IF;
  IF has_function_privilege(current_user,'public.project_hub_transfer_ownership(uuid,uuid,uuid)','execute') THEN RAISE EXCEPTION 'Fallo: bypass de propiedad'; END IF;
  PERFORM set_config('role','none',true);
END $$;
ROLLBACK;
SELECT 'Alta propia, RETURNING, marcador/documento/elemento, lector, miembro, actor, propiedad, organización, revocación, ausencia de sesión, claims y bypass: comprobados; fixtures revertidos.' AS resultado;
