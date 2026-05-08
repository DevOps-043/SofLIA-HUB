-- =====================================================================
-- SofLIA Hub - Meeting Ops tables
-- Execute this SQL in the IRIS Supabase instance (SQL Editor)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.meeting_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  owner_user_id TEXT NOT NULL,
  origin_channel TEXT NOT NULL,
  origin_ref TEXT,
  meeting_title TEXT,
  meeting_type TEXT NOT NULL,
  meeting_series_key TEXT,
  primary_source_uri TEXT,
  status TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_version INTEGER NOT NULL DEFAULT 1,
  trace_id TEXT NOT NULL UNIQUE,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_runs_owner_hash_version
  ON public.meeting_runs(owner_user_id, source_hash, source_version);
CREATE INDEX IF NOT EXISTS idx_meeting_runs_status
  ON public.meeting_runs(status);
CREATE INDEX IF NOT EXISTS idx_meeting_runs_owner
  ON public.meeting_runs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_runs_series
  ON public.meeting_runs(meeting_series_key);
CREATE INDEX IF NOT EXISTS idx_meeting_runs_source_uri
  ON public.meeting_runs(primary_source_uri);

CREATE TABLE IF NOT EXISTS public.meeting_source_artifacts (
  id TEXT PRIMARY KEY,
  meeting_run_id TEXT NOT NULL REFERENCES public.meeting_runs(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  external_file_id TEXT,
  mime_type TEXT,
  authority_level TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_sources_run_id
  ON public.meeting_source_artifacts(meeting_run_id);
CREATE INDEX IF NOT EXISTS idx_meeting_sources_sha
  ON public.meeting_source_artifacts(sha256);
CREATE INDEX IF NOT EXISTS idx_meeting_sources_uri
  ON public.meeting_source_artifacts(source_uri);

CREATE TABLE IF NOT EXISTS public.meeting_assets (
  id TEXT PRIMARY KEY,
  meeting_run_id TEXT NOT NULL REFERENCES public.meeting_runs(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  asset_version INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  executive_summary TEXT NOT NULL,
  operational_summary TEXT NOT NULL,
  review_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_assets_run_version
  ON public.meeting_assets(meeting_run_id, asset_version);
CREATE INDEX IF NOT EXISTS idx_meeting_assets_run_id
  ON public.meeting_assets(meeting_run_id);

CREATE TABLE IF NOT EXISTS public.meeting_sync_actions (
  id TEXT PRIMARY KEY,
  meeting_run_id TEXT NOT NULL REFERENCES public.meeting_runs(id) ON DELETE CASCADE,
  meeting_asset_id TEXT NOT NULL REFERENCES public.meeting_assets(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_state TEXT NOT NULL,
  sync_state TEXT NOT NULL,
  sync_target TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  external_ref TEXT,
  error_message TEXT,
  summary TEXT NOT NULL,
  blocking_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_sync_actions_run_id
  ON public.meeting_sync_actions(meeting_run_id);
CREATE INDEX IF NOT EXISTS idx_meeting_sync_actions_approval
  ON public.meeting_sync_actions(approval_state);

CREATE TABLE IF NOT EXISTS public.meeting_approvals (
  id TEXT PRIMARY KEY,
  meeting_run_id TEXT NOT NULL REFERENCES public.meeting_runs(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  scope_ref_id TEXT,
  requested_by_user_id TEXT NOT NULL,
  decided_by_user_id TEXT,
  decision TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_approvals_run_id
  ON public.meeting_approvals(meeting_run_id);

CREATE TABLE IF NOT EXISTS public.meeting_detection_candidates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  detection_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  meeting_title TEXT,
  meeting_code TEXT,
  calendar_event_id TEXT,
  gmail_message_id TEXT,
  drive_file_id TEXT,
  workflow_run_id TEXT REFERENCES public.meeting_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_detection_owner
  ON public.meeting_detection_candidates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_detection_status
  ON public.meeting_detection_candidates(status);
CREATE INDEX IF NOT EXISTS idx_meeting_detection_drive_file
  ON public.meeting_detection_candidates(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_meeting_detection_meeting_code
  ON public.meeting_detection_candidates(meeting_code);

ALTER TABLE public.meeting_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_source_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_sync_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_detection_candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow all for meeting_runs" ON public.meeting_runs;
  DROP POLICY IF EXISTS "Allow all for meeting_source_artifacts" ON public.meeting_source_artifacts;
  DROP POLICY IF EXISTS "Allow all for meeting_assets" ON public.meeting_assets;
  DROP POLICY IF EXISTS "Allow all for meeting_sync_actions" ON public.meeting_sync_actions;
  DROP POLICY IF EXISTS "Allow all for meeting_approvals" ON public.meeting_approvals;
  DROP POLICY IF EXISTS "Allow all for meeting_detection_candidates" ON public.meeting_detection_candidates;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_runs' AND policyname = 'Users manage own meeting runs'
  ) THEN
    CREATE POLICY "Users manage own meeting runs"
      ON public.meeting_runs
      FOR ALL
      USING (auth.uid()::text = owner_user_id)
      WITH CHECK (auth.uid()::text = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_source_artifacts' AND policyname = 'Users manage own meeting source artifacts'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_assets' AND policyname = 'Users manage own meeting assets'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_sync_actions' AND policyname = 'Users manage own meeting sync actions'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_approvals' AND policyname = 'Users manage own meeting approvals'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meeting_detection_candidates' AND policyname = 'Users manage own meeting detection candidates'
  ) THEN
    CREATE POLICY "Users manage own meeting detection candidates"
      ON public.meeting_detection_candidates
      FOR ALL
      USING (auth.uid()::text = owner_user_id)
      WITH CHECK (auth.uid()::text = owner_user_id);
  END IF;
END $$;
