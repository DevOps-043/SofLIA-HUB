import type { ActivitySnapshot, MonitoringConfig, MonitoringStatus } from '../../core/entities/ActivityLog';

declare global {
  interface Window {
    monitoring: {
      start: (userId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean; snapshotCount?: number; error?: string }>;
      getStatus: () => Promise<MonitoringStatus>;
      setConfig: (config: Partial<MonitoringConfig>) => Promise<{ success: boolean; config?: MonitoringConfig }>;
      cleanupScreenshots: () => Promise<{ success: boolean; deleted?: number }>;
      generateSummary: (activities: any[], sessionInfo: any) => Promise<{ success: boolean; summary?: any; error?: string }>;
      sendSummaryWhatsApp: (phoneNumber: string, summaryText: string) => Promise<{ success: boolean; error?: string }>;
      onSnapshot: (cb: (snapshot: ActivitySnapshot) => void) => void;
      onSessionStarted: (cb: (data: { userId: string; sessionId: string }) => void) => void;
      onSessionEnded: (cb: (data: { userId: string; sessionId: string; snapshotCount: number; pendingSnapshots: ActivitySnapshot[] }) => void) => void;
      onFlush: (cb: (data: { userId: string; sessionId: string; snapshots: ActivitySnapshot[] }) => void) => void;
      onError: (cb: (err: { message: string }) => void) => void;
      onSummaryGenerated: (cb: (data: { userId: string; sessionId: string; summary: any }) => void) => void;
      removeListeners: () => void;
    };
  }
}

export {};
