export interface ActivityLog {
  id: string;
  userId: string;
  timestamp: Date;
  windowTitle: string;
  processName: string;
  url?: string; // For browser windows if possible
  category: ActivityCategory;
  durationSeconds: number;
  idle: boolean;
}

export type ActivityCategory = 'productive' | 'unproductive' | 'neutral' | 'uncategorized';

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalTimeSeconds: number;
  productiveTimeSeconds: number;
  unproductiveTimeSeconds: number;
  idleTimeSeconds: number;
  topApps: { name: string; duration: number }[];
}
