export interface ClipboardConfig {
  maxHistorySize?: number;
  pollingIntervalMs?: number;
}

export interface ClipboardToolActions {
  readText: () => string;
  writeText: (text: string) => void;
  getHistory: () => string[];
}
