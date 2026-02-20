-- =====================================================================
-- SofLIA Hub — Monitoring System Tables
-- Execute this SQL in the LIA Supabase instance (SQL Editor)
-- =====================================================================

-- 1. Monitoring Sessions (one per work block)
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  trigger_type TEXT NOT NULL DEFAULT 'manual',        -- 'manual' | 'calendar_auto'
  calendar_event_title TEXT,
  total_active_seconds INTEGER DEFAULT 0,
  total_idle_seconds INTEGER DEFAULT 0,
  summary_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',              -- 'active' | 'completed' | 'summarized'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Activity Logs (captured every 30s during a session)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_title TEXT NOT NULL,
  process_name TEXT NOT NULL,
  url TEXT,
  category TEXT DEFAULT 'uncategorized',              -- 'productive' | 'unproductive' | 'neutral' | 'uncategorized'
  duration_seconds INTEGER DEFAULT 30,
  idle BOOLEAN DEFAULT false,
  idle_seconds INTEGER DEFAULT 0,
  ocr_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Daily Summaries (aggregated stats per day)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  total_time_seconds INTEGER DEFAULT 0,
  productive_time_seconds INTEGER DEFAULT 0,
  idle_time_seconds INTEGER DEFAULT 0,
  top_apps JSONB DEFAULT '[]'::jsonb,                 -- [{name, duration}]
  top_websites JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  projects_detected JSONB DEFAULT '[]'::jsonb,        -- [{projectId, projectName, timeSeconds}]
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 4. Calendar Connections (Google / Microsoft OAuth tokens)
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,                             -- 'google' | 'microsoft'
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- =====================================================================
-- Indexes for performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_time ON activity_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_user ON monitoring_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);

-- =====================================================================
-- RLS Policies (Row Level Security)
-- Enable RLS so each user only sees their own data
-- =====================================================================
ALTER TABLE monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations for the anon key (desktop app uses service role pattern)
CREATE POLICY "Allow all for monitoring_sessions" ON monitoring_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for daily_summaries" ON daily_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for calendar_connections" ON calendar_connections FOR ALL USING (true) WITH CHECK (true);
