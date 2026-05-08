import { supabase } from '../../../lib/supabase';
import type { ActivityLog } from '../../../core/entities/ActivityLog';
import { activityLogToRow, rowToActivityLog } from './mappers';
import type { ActivityLogRow } from './row-types';

export async function saveActivityLog(log: ActivityLog): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert(activityLogToRow(log));
  if (error) throw new Error(`Failed to save activity log: ${error.message}`);
}

export async function saveActivityLogBatch(logs: ActivityLog[]): Promise<void> {
  if (logs.length === 0) return;
  const { error } = await supabase.from('activity_logs').insert(logs.map(activityLogToRow));
  if (error) throw new Error(`Failed to save activity batch: ${error.message}`);
}

export async function getLastActivityLog(userId: string): Promise<ActivityLog | null> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return rowToActivityLog(data as ActivityLogRow);
}

export async function getActivityLogs(userId: string, sessionId: string): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });
  if (error || !data) return [];
  return (data as ActivityLogRow[]).map(rowToActivityLog);
}

export async function getActivityLogsByDate(userId: string, date: string): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', `${date}T00:00:00.000Z`)
    .lte('timestamp', `${date}T23:59:59.999Z`)
    .order('timestamp', { ascending: true });
  if (error || !data) return [];
  return (data as ActivityLogRow[]).map(rowToActivityLog);
}
