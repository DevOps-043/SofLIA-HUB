export interface DailyBriefingConfig {
  enabled: boolean;
  schedule: string;
  ownerNumber: string;
  apiKey: string;
}

export interface DailyBriefingStatus {
  isRunning: boolean;
  lastRun?: Date;
  config: DailyBriefingConfig;
}

export interface DailyBriefingSystemData {
  dateStr: string;
  freeMem: string;
  totalMem: string;
  diskInfo: string;
  processesInfo: string;
  formatted: string;
}
