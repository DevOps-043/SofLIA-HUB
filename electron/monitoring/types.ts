export interface MonitoringConfig {
  intervalSeconds: number;
  idleThresholdSeconds: number;
  screenshotEnabled: boolean;
  ocrEnabled: boolean;
  semanticSnapshotEnabled?: boolean;
  targetDisplayId?: string;
}

export interface ActivitySnapshot {
  windowTitle: string;
  processName: string;
  url?: string;
  idle: boolean;
  idleSeconds: number;
  screenshotPath?: string;
  ocrText?: string;
  semanticSnapshot?: string;
  timestamp: Date;
}

export interface MonitoringDiagnostics {
  sharpAvailable: boolean;
  activeWinAvailable: boolean;
  screenshotFailCount: number;
  activeWinFailCount: number;
}

export interface MonitoringStatus {
  isRunning: boolean;
  sessionId: string | null;
  userId: string | null;
  snapshotCount: number;
  currentWindow?: string;
  config: MonitoringConfig;
  diagnostics?: MonitoringDiagnostics;
}
