-- =====================================================================
-- SofLIA Hub - indices para SOFIA / SofLIA Learning / CourseGen
-- Ejecutar en la instancia Supabase compartida de SOFIA/Learning.
-- No ejecutar dentro de BEGIN/COMMIT.
-- =====================================================================

-- Login y auto-resolucion desde Hub/WhatsApp.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_users_lower_email
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_users_lower_username
  ON public.users (lower(username));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_users_phone
  ON public.users (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_users_updated_at
  ON public.users (updated_at DESC);

-- Organizaciones/equipos consumidos por SofLIA Hub.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_users_user_status
  ON public.organization_users (user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_users_org_status
  ON public.organization_users (organization_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_users_team_status
  ON public.organization_users (team_id, status)
  WHERE team_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_teams_org_active
  ON public.organization_teams (organization_id, is_active, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_zones_org_active
  ON public.organization_zones (organization_id, is_active, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_organization_regions_org_active
  ON public.organization_regions (organization_id, is_active, name);

-- SofLIA Learning: catalogo de cursos y experiencia del alumno.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_courses_public_listing
  ON public.courses (is_active, approval_status, category, level, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_courses_instructor_updated
  ON public.courses (instructor_id, updated_at DESC)
  WHERE instructor_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_course_modules_course_order
  ON public.course_modules (course_id, module_order_index);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_course_lessons_module_order
  ON public.course_lessons (module_id, lesson_order_index);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_enrollments_user_status_access
  ON public.user_course_enrollments (user_id, enrollment_status, last_accessed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_enrollments_course_status
  ON public.user_course_enrollments (course_id, enrollment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_lesson_progress_enrollment_lesson
  ON public.user_lesson_progress (enrollment_id, lesson_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_lesson_progress_user_access
  ON public.user_lesson_progress (user_id, last_accessed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_lesson_notes_user_lesson_updated
  ON public.user_lesson_notes (user_id, lesson_id, updated_at DESC);

-- CourseGen / CourseEngine inbox: consumo asincrono y recuperacion de errores.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courseengine_inbox_status_created
  ON public.courseengine_inbox (status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courseengine_inbox_error_updated
  ON public.courseengine_inbox (updated_at DESC)
  WHERE status = 'error';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_staging_status_submitted
  ON public.courses_staging (status, submitted_at DESC);

-- Auditoria previa: estas constraints mejoran idempotencia pero pueden fallar
-- si ya existen duplicados.
SELECT user_id, course_id, count(*) AS duplicates
FROM public.user_course_enrollments
GROUP BY user_id, course_id
HAVING count(*) > 1
ORDER BY duplicates DESC;

SELECT organization_id, user_id, count(*) AS duplicates
FROM public.organization_users
WHERE status <> 'removed'
GROUP BY organization_id, user_id
HAVING count(*) > 1
ORDER BY duplicates DESC;

-- Opcional despues de confirmar cero duplicados:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_enrollments_user_course_unique
--   ON public.user_course_enrollments (user_id, course_id);
--
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sofia_org_users_active_unique
--   ON public.organization_users (organization_id, user_id)
--   WHERE status <> 'removed';
