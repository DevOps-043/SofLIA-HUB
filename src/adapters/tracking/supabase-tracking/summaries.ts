import { supabase } from '../../../lib/supabase';
import type { DailySummary } from '../../../core/entities/ActivityLog';
import { rowToSummary } from './mappers';
import type { SummaryRow } from './row-types';

export async function saveDailySummary(summary: DailySummary): Promise<void> {
  const { error } = await supabase.from('daily_summaries').upsert({
    user_id: summary.userId,
    date: summary.date,
    total_time_seconds: summary.totalTimeSeconds,
    productive_time_seconds: summary.productiveTimeSeconds,
    idle_time_seconds: summary.idleTimeSeconds,
    top_apps: summary.topApps,
    ai_summary: summary.aiSummary || null,
    projects_detected: summary.projectsDetected || [],
  }, { onConflict: 'user_id,date' });
  if (error) throw new Error(`Failed to save daily summary: ${error.message}`);
}

export async function getDailySummary(userId: string, date: string): Promise<DailySummary | null> {
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();
  if (error || !data) return null;
  return rowToSummary(data as SummaryRow);
}

export async function getWeeklySummaries(userId: string, startDate: string): Promise<DailySummary[]> {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 7);
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', end.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error || !data) return [];
  return (data as SummaryRow[]).map(rowToSummary);
}
