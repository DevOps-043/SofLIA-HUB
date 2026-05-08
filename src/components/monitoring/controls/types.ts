import type { MonitoringStatus } from '../../../core/entities/ActivityLog';

export interface MonitoringControlsProps {
  userId: string;
  calendarAutoSessionId?: string | null;
  calendarEventTitle?: string | null;
  onManualStop?: () => void;
  onDataFlushed?: () => void;
}

export interface MonitoringControlsState {
  status: MonitoringStatus | null;
  elapsedSeconds: number;
  currentWindow: string;
  loading: boolean;
  error: string | null;
  persistError: string | null;
  isRunning: boolean;
}
