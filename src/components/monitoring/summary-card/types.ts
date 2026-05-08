import type { ActivityLog, DailySummary } from '../../../core/entities/ActivityLog';

export interface SummaryCardProps {
  summary: DailySummary | null;
  userId: string;
  logs: ActivityLog[];
  selectedDate: string;
  onSummaryGenerated: (summary: DailySummary) => void;
}
