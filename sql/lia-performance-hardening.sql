-- =====================================================================
-- SofLIA Hub - indices de performance para instancia Lia
-- Ejecutar en Supabase Lia. No ejecutar dentro de BEGIN/COMMIT.
-- Usa CONCURRENTLY para reducir bloqueo en tablas con usuarios activos.
-- =====================================================================

-- Chat y carpetas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversations_user_updated_desc
  ON public.conversations (user_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversations_folder_updated_desc
  ON public.conversations (folder_id, updated_at DESC)
  WHERE folder_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversations_org_updated_desc
  ON public.conversations (org_id, updated_at DESC)
  WHERE org_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_messages_conversation_created_asc
  ON public.messages (conversation_id, created_at ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_messages_user_created_desc
  ON public.messages (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folders_user_created_desc
  ON public.folders (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folders_org_created_desc
  ON public.folders (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;

-- Comparticion directa y por organizacion
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversation_shares_user_active_created
  ON public.conversation_shares (shared_with_user_id, created_at DESC)
  WHERE is_active = true AND shared_with_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversation_shares_org_active_created
  ON public.conversation_shares (org_id, created_at DESC)
  WHERE is_active = true AND shared_with_user_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversation_shares_shared_by_active_created
  ON public.conversation_shares (shared_by, created_at DESC)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_conversation_shares_conversation_active
  ON public.conversation_shares (conversation_id, created_at DESC)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folder_shares_user_active_created
  ON public.folder_shares (shared_with_user_id, created_at DESC)
  WHERE is_active = true AND shared_with_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folder_shares_org_active_created
  ON public.folder_shares (org_id, created_at DESC)
  WHERE is_active = true AND shared_with_user_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folder_shares_shared_by_active_created
  ON public.folder_shares (shared_by, created_at DESC)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_folder_shares_folder_active
  ON public.folder_shares (folder_id, created_at DESC)
  WHERE is_active = true;

-- Fuentes/archivos ligados a conversaciones
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_workspace_sources_conversation_created
  ON public.workspace_sources (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_workspace_sources_folder_created
  ON public.workspace_sources (folder_id, created_at DESC)
  WHERE folder_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_workspace_sources_org_created
  ON public.workspace_sources (org_id, created_at DESC);

-- Monitoreo/productividad
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_activity_logs_user_timestamp_desc
  ON public.activity_logs (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_activity_logs_session_timestamp_asc
  ON public.activity_logs (session_id, timestamp ASC)
  WHERE session_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_activity_logs_timestamp_brin
  ON public.activity_logs USING brin (timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_monitoring_sessions_user_status_started
  ON public.monitoring_sessions (user_id, status, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_daily_summaries_user_date_desc
  ON public.daily_summaries (user_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lia_calendar_connections_user_provider_active
  ON public.calendar_connections (user_id, provider)
  WHERE is_active = true;
