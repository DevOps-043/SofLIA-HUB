-- =====================================================================
-- SofLIA Hub - indices de performance para instancia IRIS
-- Ejecutar en Supabase IRIS. No ejecutar dentro de BEGIN/COMMIT.
-- =====================================================================

-- Busqueda/resolucion de equipos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_teams_status_name
  ON public.teams (status, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_teams_lower_name
  ON public.teams (lower(name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_teams_lower_slug
  ON public.teams (lower(slug));

-- Proyectos usados por Project Hub y resolucion desde WhatsApp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_pm_projects_team_updated
  ON public.pm_projects (team_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_pm_projects_team_key_active
  ON public.pm_projects (team_id, project_key)
  WHERE archived_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_pm_projects_lower_name_active
  ON public.pm_projects (lower(project_name))
  WHERE archived_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_pm_projects_status_updated
  ON public.pm_projects (project_status, updated_at DESC);

-- Issues/tareas. Estas son rutas calientes de lectura.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_issues_project_updated_open
  ON public.task_issues (project_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_issues_team_updated_open
  ON public.task_issues (team_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_issues_assignee_updated_open
  ON public.task_issues (assignee_id, updated_at DESC)
  WHERE archived_at IS NULL AND assignee_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_issues_team_issue_number
  ON public.task_issues (team_id, issue_number);

-- Catalogos chicos, pero muy consultados por cada creacion de issue.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_statuses_team_position
  ON public.task_statuses (team_id, position);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_statuses_team_type
  ON public.task_statuses (team_id, status_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_priorities_level
  ON public.task_priorities (level);

-- Miembros y usuarios para asignaciones.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_team_members_team_active_user
  ON public.team_members (team_id, is_active, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_account_users_lower_email
  ON public.account_users (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_account_users_lower_username
  ON public.account_users (lower(username))
  WHERE username IS NOT NULL;

-- Meeting Ops
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_meeting_runs_owner_status_updated
  ON public.meeting_runs (owner_user_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_meeting_sync_actions_state_created
  ON public.meeting_sync_actions (approval_state, sync_state, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_meeting_detection_workflow_status
  ON public.meeting_detection_candidates (workflow_run_id, status)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_meeting_detection_status_checked
  ON public.meeting_detection_candidates (status, last_checked_at DESC);

-- Auditorias previas antes de convertir indices en UNIQUE.
-- Si devuelven filas, resolver duplicados antes de crear constraints.
SELECT team_id, issue_number, count(*) AS duplicates
FROM public.task_issues
GROUP BY team_id, issue_number
HAVING count(*) > 1
ORDER BY duplicates DESC;

SELECT team_id, project_key, count(*) AS duplicates
FROM public.pm_projects
WHERE archived_at IS NULL
GROUP BY team_id, project_key
HAVING count(*) > 1
ORDER BY duplicates DESC;

-- Opcional despues de confirmar cero duplicados:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_task_issues_team_issue_number_unique
--   ON public.task_issues (team_id, issue_number);
--
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_iris_pm_projects_team_key_active_unique
--   ON public.pm_projects (team_id, project_key)
--   WHERE archived_at IS NULL;
