-- =====================================================================
-- SofLIA Hub - endurecimiento RLS para politicas heredadas permisivas
-- Ejecutar en el proyecto Supabase correspondiente despues de verificar
-- que auth.uid() coincide con user_id / owner_user_id en cada tabla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Instancia Lia: monitoreo y conexiones OAuth
-- ---------------------------------------------------------------------
ALTER TABLE public.monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for monitoring_sessions" ON public.monitoring_sessions;
DROP POLICY IF EXISTS "Allow all for activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow all for daily_summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Allow all for calendar_connections" ON public.calendar_connections;

CREATE POLICY "Users manage own monitoring sessions"
  ON public.monitoring_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own activity logs"
  ON public.activity_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own daily summaries"
  ON public.daily_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own calendar connections"
  ON public.calendar_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Instancia IRIS: tablas Meeting Ops. Las filas hijas heredan acceso desde
-- public.meeting_runs.owner_user_id.
-- ---------------------------------------------------------------------
ALTER TABLE public.meeting_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_source_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_sync_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_detection_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for meeting_runs" ON public.meeting_runs;
DROP POLICY IF EXISTS "Allow all for meeting_source_artifacts" ON public.meeting_source_artifacts;
DROP POLICY IF EXISTS "Allow all for meeting_assets" ON public.meeting_assets;
DROP POLICY IF EXISTS "Allow all for meeting_sync_actions" ON public.meeting_sync_actions;
DROP POLICY IF EXISTS "Allow all for meeting_approvals" ON public.meeting_approvals;
DROP POLICY IF EXISTS "Allow all for meeting_detection_candidates" ON public.meeting_detection_candidates;

CREATE POLICY "Users manage own meeting runs"
  ON public.meeting_runs
  FOR ALL
  USING (auth.uid()::text = owner_user_id)
  WITH CHECK (auth.uid()::text = owner_user_id);

CREATE POLICY "Users manage own meeting detection candidates"
  ON public.meeting_detection_candidates
  FOR ALL
  USING (auth.uid()::text = owner_user_id)
  WITH CHECK (auth.uid()::text = owner_user_id);

CREATE POLICY "Users manage own meeting source artifacts"
  ON public.meeting_source_artifacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_source_artifacts.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_source_artifacts.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users manage own meeting assets"
  ON public.meeting_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_assets.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_assets.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users manage own meeting sync actions"
  ON public.meeting_sync_actions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_sync_actions.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_sync_actions.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users manage own meeting approvals"
  ON public.meeting_approvals
  FOR ALL
  USING (
    requested_by_user_id = auth.uid()::text
    OR decided_by_user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_approvals.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    requested_by_user_id = auth.uid()::text
    OR decided_by_user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.meeting_runs run
      WHERE run.id = meeting_approvals.meeting_run_id
        AND run.owner_user_id = auth.uid()::text
    )
  );
