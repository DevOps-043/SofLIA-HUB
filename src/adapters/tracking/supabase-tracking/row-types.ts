export interface ActivityLogRow {
  id: string;
  session_id: string | null;
  user_id: string;
  timestamp: string;
  window_title: string;
  process_name: string;
  url: string | null;
  category: string;
  duration_seconds: number;
  idle: boolean;
  idle_seconds: number;
  ocr_text: string | null;
  metadata: Record<string, any>;
}

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  trigger_type: string;
  calendar_event_title: string | null;
  total_active_seconds: number;
  total_idle_seconds: number;
  summary_text: string | null;
  status: string;
  created_at: string;
}

export interface SummaryRow {
  id: string;
  user_id: string;
  date: string;
  total_time_seconds: number;
  productive_time_seconds: number;
  idle_time_seconds: number;
  top_apps: { name: string; duration: number }[];
  ai_summary: string | null;
  projects_detected: { projectId: string; projectName: string; timeSeconds: number }[];
  created_at: string;
}
