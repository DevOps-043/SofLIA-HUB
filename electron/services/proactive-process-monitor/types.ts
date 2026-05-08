export interface ProactiveMonitorConfig {
  enabled: boolean;
  checkIntervalMs: number;
  cpuThresholdPercent: number;
  consecutiveChecksToAlert: number;
  notifyPhone: string | null;
}

export interface ProcessState {
  name: string;
  consecutiveHighCpu: number;
  lastMem: number;
}
