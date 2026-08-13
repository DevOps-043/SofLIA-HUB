export interface ClipboardConfig {
  maxHistorySize?: number;
  pollingIntervalMs?: number;
}

export interface ClipboardToolActions {
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<void>;
  getHistory: () => string[];
}
