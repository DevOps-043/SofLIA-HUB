export interface DailyDigestConfig {
  phoneNumber: string;
  scheduleHour: number;
  scheduleMinute: number;
  enabled: boolean;
}

export interface DailyDigestStats {
  totalMem: string;
  usedMem: number;
  memPercent: number;
  cpuModel: string;
  cpuCores: number;
  uptime: string;
  diskInfo: string;
  autoDevRuns: number;
  desktopTasks: number;
  savedHours: string;
  capitalizedDate: string;
  year: number;
}
