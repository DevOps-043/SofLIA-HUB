-- Instancia IRIS / Project Hub. Auditoría de sólo lectura, 2026-10-22.
-- Consulta catálogos; no lee registros de negocio, credenciales ni datos personales.
-- No es migración. No modifica privilegios, esquema ni registros.
WITH RECURSIVE affected(oid) AS (
 SELECT oid FROM pg_class WHERE oid IN ('public.pm_projects'::regclass, 'public.task_issues'::regclass)
 UNION
 SELECT c.conrelid FROM pg_constraint c JOIN affected a ON c.confrelid=a.oid WHERE c.contype='f'
)
SELECT jsonb_build_object(
 'tables', (SELECT jsonb_agg(jsonb_build_object('table', c.oid::regclass::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl::text)) FROM pg_class c WHERE c.oid IN (SELECT oid FROM affected)),
 'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND to_regclass(format('%I.%I',p.schemaname,p.tablename)) IN (SELECT oid FROM affected)),
 'foreignKeys', (SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'parent',confrelid::regclass::text,'constraint',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE contype='f' AND confrelid IN (SELECT oid FROM affected)),
 'deleteFunctions', (SELECT jsonb_agg(jsonb_build_object('name',proname,'arguments',pg_get_function_identity_arguments(p.oid),'securityDefiner',prosecdef,'acl',proacl::text)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname ILIKE '%project%' AND proname ILIKE '%delet%')
) AS contract;

SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'nullable',is_nullable)) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('pm_projects','task_issues','account_users','workspace_members','workspaces','team_members','teams')),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('account_users','workspace_members','workspaces','team_members','teams')),
 'authMappingConstraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE contype='f' AND conrelid IN ('public.account_users'::regclass,'public.workspace_members'::regclass,'public.teams'::regclass,'public.workspaces'::regclass))
) AS identity_contract;
