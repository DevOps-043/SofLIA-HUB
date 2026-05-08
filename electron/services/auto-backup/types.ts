export interface AutoBackupConfig {
  sourceDirs: string[];
  outputDir: string;
  intervalDays?: number;
  prefix?: string;
}

export interface BackupStatus {
  isBackingUp: boolean;
  lastBackupDate?: Date;
  lastBackupSize?: number;
  lastBackupPath?: string;
  error?: string;
  nextBackupDate?: Date;
}
