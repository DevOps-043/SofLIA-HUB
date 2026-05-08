export interface SystemStatus {
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  memoryUsagePercent: number;
  cpuLoadPercent: number;
  uptimeSeconds: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

export interface SystemAlert {
  id: string;
  type: 'memory_low' | 'cpu_high' | 'system_critical';
  message: string;
  timestamp: Date;
  data: SystemStatus;
}

export interface OrganizeSummary {
  directory: string;
  totalProcessed: number;
  moved: Record<string, number>;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export interface DirectoryAnalysis {
  totalFiles: number;
  categories: Record<string, number>;
  totalSize: number;
}
