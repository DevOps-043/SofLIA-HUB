export interface CleanupConfig {
  checkIntervalMs?: number;
  sizeThresholdBytes?: number;
  ageThresholdDays?: number;
}

export interface CleanupStatus {
  isMonitoring: boolean;
  lastCheck?: Date;
  bytesFound: number;
  filesToClean: string[];
}

export interface CleanupScanResult {
  totalSize: number;
  filesToClean: string[];
  totalBytesFound: number;
}
