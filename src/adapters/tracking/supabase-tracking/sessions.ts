import { supabase } from '../../../lib/supabase';
import type { MonitoringSession } from '../../../core/entities/ActivityLog';
import { rowToSession } from './mappers';
import type { SessionRow } from './row-types';

export async function createSession(session: Omit<MonitoringSession, 'id' | 'createdAt'>): Promise<MonitoringSession> {
  const { data, error } = await supabase.from('monitoring_sessions').insert({
    user_id: session.userId,
    started_at: session.startedAt.toISOString(),
    ended_at: session.endedAt?.toISOString() || null,
    trigger_type: session.triggerType,
    calendar_event_title: session.calendarEventTitle || null,
    total_active_seconds: session.totalActiveSeconds,
    total_idle_seconds: session.totalIdleSeconds,
    summary_text: session.summaryText || null,
    status: session.status,
  }).select().single();
  if (error || !data) throw new Error(`Failed to create session: ${error?.message}`);
  return rowToSession(data as SessionRow);
}

export async function updateSession(id: string, updates: Partial<MonitoringSession>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.endedAt !== undefined) row.ended_at = updates.endedAt?.toISOString() || null;
  if (updates.totalActiveSeconds !== undefined) row.total_active_seconds = updates.totalActiveSeconds;
  if (updates.totalIdleSeconds !== undefined) row.total_idle_seconds = updates.totalIdleSeconds;
  if (updates.summaryText !== undefined) row.summary_text = updates.summaryText;
  if (updates.status !== undefined) row.status = updates.status;
  const { error } = await supabase.from('monitoring_sessions').update(row).eq('id', id);
  if (error) throw new Error(`Failed to update session: ${error.message}`);
}

export async function getActiveSession(userId: string): Promise<MonitoringSession | null> {
  const { data, error } = await supabase
    .from('monitoring_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return rowToSession(data as SessionRow);
}

export async function getSessionsByDate(userId: string, date: string): Promise<MonitoringSession[]> {
  const { data, error } = await supabase
    .from('monitoring_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', `${date}T00:00:00.000Z`)
    .lte('started_at', `${date}T23:59:59.999Z`)
    .order('started_at', { ascending: true });
  if (error || !data) return [];
  return (data as SessionRow[]).map(rowToSession);
}
