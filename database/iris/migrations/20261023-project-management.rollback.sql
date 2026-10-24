-- IRIS: aplicar solo después de retirar las rutas v1 dependientes.
-- No borra equipos, tareas, hitos, asociaciones ni archivos creados.
BEGIN;
DROP FUNCTION IF EXISTS public.hub_archive_task_v1(uuid,uuid,uuid,timestamptz);
DROP FUNCTION IF EXISTS public.hub_mutate_task_v1(uuid,uuid,uuid,uuid,jsonb);
DROP FUNCTION IF EXISTS public.hub_manage_team_member_v1(uuid,uuid,uuid,text,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.hub_assign_project_team_v1(uuid,uuid,uuid,timestamptz);
DROP FUNCTION IF EXISTS public.hub_create_team_v1(uuid,uuid,text,text,text);
COMMIT;
