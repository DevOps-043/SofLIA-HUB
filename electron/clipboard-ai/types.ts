export interface ClipboardConfig {
  maxHistorySize?: number;
  pollingIntervalMs?: number;
}

export interface ClipboardStatus {
  isRunning: boolean;
  historyCount: number;
}

export interface ClipboardItem {
  id: string;
  timestamp: number;
  text: string;
}
