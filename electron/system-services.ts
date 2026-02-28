import * as os from 'os';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

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

// ==========================================
// SYSTEM GUARDIAN SERVICE
// ==========================================

/**
 * Native system monitoring service that replaces the vulnerable 'systeminformation' package.
 * Evaluates CPU and RAM natively using Node.js 'os' module.
 */
export class SystemGuardianService extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private previousCpuTimes: { idle: number; total: number } | null = null;
  private alertHistory: SystemAlert[] = [];
  
  // Threshold configurations
  private readonly memoryCriticalThreshold = 90; // >90% memory used = critical (<10% free)
  private readonly memoryWarningThreshold = 80;
  private readonly cpuCriticalThreshold = 90;
  private readonly cpuWarningThreshold = 80;

  constructor() {
    super();
    // Warm up CPU times calculation
    this.calculateCpuLoad();
  }

  /**
   * Starts monitoring the system resources.
   * @param callback Optional callback to receive status updates.
   * @param intervalMs Check interval in milliseconds. Default 5 minutes (300000ms).
   */
  public startMonitoring(callback?: (status: SystemStatus) => void, intervalMs: number = 300000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`[SystemGuardian] Starting system monitoring every ${intervalMs}ms.`);
    
    // Perform an initial check
    this.checkSystemStatus(callback);

    // Set up the interval
    this.monitoringInterval = setInterval(() => {
      this.checkSystemStatus(callback);
    }, intervalMs);
  }

  /**
   * Stops the monitoring interval.
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[SystemGuardian] System monitoring stopped.');
    }
  }

  /**
   * Generates a comprehensive summary of the system's health, suitable for WhatsApp or an Agent.
   */
  public getSystemSummary(): string {
    const status = this.getSystemStatus();
    const freeRamGB = (status.freeMemoryBytes / 1024 / 1024 / 1024).toFixed(2);
    const totalRamGB = (status.totalMemoryBytes / 1024 / 1024 / 1024).toFixed(2);
    
    let summary = `*System Health Report*\n`;
    summary += `Status: ${status.status.toUpperCase() === 'HEALTHY' ? '🟢 Healthy' : status.status.toUpperCase() === 'WARNING' ? '🟡 Warning' : '🔴 Critical'}\n`;
    summary += `CPU Load: ${status.cpuLoadPercent.toFixed(1)}%\n`;
    summary += `Memory: ${freeRamGB} GB free of ${totalRamGB} GB\n`;
    summary += `Memory Usage: ${status.memoryUsagePercent.toFixed(1)}%\n`;
    summary += `Uptime: ${(status.uptimeSeconds / 3600).toFixed(1)} hours\n`;
    
    if (this.alertHistory.length > 0) {
      const recentAlerts = this.alertHistory.slice(-3);
      summary += `\n*Recent Alerts:*\n`;
      recentAlerts.forEach(alert => {
        summary += `- [${alert.timestamp.toLocaleTimeString()}] ${alert.message}\n`;
      });
    }

    return summary;
  }

  /**
   * Retrieves current system metrics directly from 'os' APIs.
   */
  public getSystemStatus(): SystemStatus {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const memoryUsagePercent = ((totalMemoryBytes - freeMemoryBytes) / totalMemoryBytes) * 100;
    
    const cpuLoadPercent = this.calculateCpuLoad();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (memoryUsagePercent > this.memoryCriticalThreshold || cpuLoadPercent > this.cpuCriticalThreshold) {
      status = 'critical';
    } else if (memoryUsagePercent > this.memoryWarningThreshold || cpuLoadPercent > this.cpuWarningThreshold) {
      status = 'warning';
    }

    return {
      totalMemoryBytes,
      freeMemoryBytes,
      memoryUsagePercent,
      cpuLoadPercent,
      uptimeSeconds: os.uptime(),
      status,
      timestamp: new Date()
    };
  }

  /**
   * Get past alerts history (up to 100)
   */
  public getAlertHistory(): SystemAlert[] {
    return this.alertHistory;
  }

  /**
   * Clears the current alert history.
   */
  public clearAlertHistory(): void {
    this.alertHistory = [];
  }

  private checkSystemStatus(callback?: (status: SystemStatus) => void): void {
    const status = this.getSystemStatus();
    
    // Check for low memory (RAM free < 10%)
    if (status.memoryUsagePercent > this.memoryCriticalThreshold) {
      const freeRamGB = (status.freeMemoryBytes / 1024 / 1024 / 1024).toFixed(2);
      this.triggerAlert({
        id: `mem-${Date.now()}`,
        type: 'memory_low',
        message: `Low memory alert! Only ${freeRamGB}GB remaining (${(100 - status.memoryUsagePercent).toFixed(1)}% free)`,
        timestamp: new Date(),
        data: status
      });
    }

    // Check for high CPU
    if (status.cpuLoadPercent > this.cpuCriticalThreshold) {
      this.triggerAlert({
        id: `cpu-${Date.now()}`,
        type: 'cpu_high',
        message: `High CPU load! Currently at ${status.cpuLoadPercent.toFixed(1)}%`,
        timestamp: new Date(),
        data: status
      });
    }

    // Invoke callback if provided
    if (callback) {
      try {
        callback(status);
      } catch (err) {
        console.error('[SystemGuardian] Error in monitoring callback:', err);
      }
    }
  }

  private triggerAlert(alert: SystemAlert): void {
    console.warn(`[SystemGuardian] ALERT [${alert.type}]: ${alert.message}`);
    this.alertHistory.push(alert);
    
    // Keep history bounded to 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }
    
    this.emit('alert', alert);
  }

  /**
   * Calculates the CPU load percentage by comparing current idle ticks vs total ticks
   * against the previous measurement.
   */
  private calculateCpuLoad(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    if (this.previousCpuTimes) {
      const idleDifference = totalIdle - this.previousCpuTimes.idle;
      const totalDifference = totalTick - this.previousCpuTimes.total;
      
      this.previousCpuTimes = { idle: totalIdle, total: totalTick };
      
      if (totalDifference === 0) return 0;
      return 100 - Math.floor(100 * idleDifference / totalDifference);
    } else {
      // First pass, initialize previous and return 0
      this.previousCpuTimes = { idle: totalIdle, total: totalTick };
      return 0;
    }
  }
}

// ==========================================
// NEURAL ORGANIZER SERVICE
// ==========================================

/**
 * Advanced Native file organizer.
 * Uses native fs Promises to cleanly classify and move files by extension.
 */
export class NeuralOrganizerService {
  private readonly categoryMap: Record<string, string[]> = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.odt', '.ods'],
    'Installers': ['.exe', '.msi', '.pkg', '.dmg', '.deb', '.rpm', '.appimage'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
    'Media': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.mp3', '.wav', '.flac', '.m4a', '.ogg'],
    'Code': ['.js', '.ts', '.html', '.css', '.json', '.xml', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rb', '.php', '.sql', '.yaml', '.yml']
  };

  private extToCategory: Record<string, string> = {};

  constructor() {
    this.buildExtensionMap();
  }

  private buildExtensionMap(): void {
    for (const [category, extensions] of Object.entries(this.categoryMap)) {
      for (const ext of extensions) {
        this.extToCategory[ext.toLowerCase()] = category;
      }
    }
  }

  /**
   * Scans a directory and returns an analysis of its contents by category without moving them.
   * @param dirPath The directory path to analyze.
   */
  public async analyzeDirectory(dirPath: string): Promise<DirectoryAnalysis> {
    const analysis: DirectoryAnalysis = {
      totalFiles: 0,
      categories: {},
      totalSize: 0
    };

    try {
      const dirStat = await fsPromises.stat(dirPath);
      if (!dirStat.isDirectory()) {
        throw new Error(`Path ${dirPath} is not a directory`);
      }

      const files = await fsPromises.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stats = await fsPromises.stat(filePath);
          if (stats.isFile()) {
            analysis.totalFiles++;
            analysis.totalSize += stats.size;

            const ext = path.extname(file).toLowerCase();
            const category = ext ? (this.extToCategory[ext] || 'Others') : 'No_Extension';
            
            analysis.categories[category] = (analysis.categories[category] || 0) + 1;
          }
        } catch (e) {
          // Ignore files we cannot stat (permissions, symlinks, etc)
          console.warn(`[NeuralOrganizer] Cannot stat file for analysis: ${filePath}`, e);
        }
      }
    } catch (error) {
      throw new Error(`Analysis failed for ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return analysis;
  }

  /**
   * Organizes the files in the specified directory into subfolders based on their extensions.
   * @param dirPath The directory to organize.
   */
  public async organizeDirectory(dirPath: string): Promise<OrganizeSummary> {
    console.log(`[NeuralOrganizer] Starting organization for: ${dirPath}`);
    
    const summary: OrganizeSummary = {
      directory: dirPath,
      totalProcessed: 0,
      moved: {},
      errors: [],
      startTime: new Date(),
      endTime: new Date() // Will be updated at end
    };

    try {
      // Validate directory
      const dirStat = await fsPromises.stat(dirPath);
      if (!dirStat.isDirectory()) {
        throw new Error(`Path ${dirPath} is not a valid directory`);
      }

      const files = await fsPromises.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = await fsPromises.stat(filePath);
          
          if (!stats.isFile()) {
            continue; // Skip subdirectories to avoid deep recursion problems
          }

          const ext = path.extname(file).toLowerCase();
          
          // Only organize files with extensions that we know, or put in Others
          const category = ext ? (this.extToCategory[ext] || 'Others') : 'Others';
          
          // Skip if we shouldn't move it (e.g. system files like desktop.ini)
          if (file.toLowerCase() === 'desktop.ini' || file.startsWith('.')) {
            continue;
          }

          // Ensure category directory exists
          const categoryPath = path.join(dirPath, category);
          try {
            await fsPromises.access(categoryPath);
          } catch (e) {
            await fsPromises.mkdir(categoryPath, { recursive: true });
          }

          // Determine target path
          let newFilePath = path.join(categoryPath, file);
          
          // Conflict resolution
          try {
            await fsPromises.access(newFilePath);
            // File exists in destination, rename it using a timestamp
            const nameWithoutExt = path.basename(file, ext);
            const renamedFile = `${nameWithoutExt}_${Date.now()}${ext}`;
            newFilePath = path.join(categoryPath, renamedFile);
          } catch (e) {
            // File doesn't exist in destination, which is what we want
          }

          // Move the file natively
          await fsPromises.rename(filePath, newFilePath);
          
          // Update summary
          summary.totalProcessed++;
          summary.moved[category] = (summary.moved[category] || 0) + 1;

        } catch (fileError) {
          const errorMsg = `Failed to process ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
          console.error(`[NeuralOrganizer] ${errorMsg}`);
          summary.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[NeuralOrganizer] ${errorMsg}`);
      summary.errors.push(errorMsg);
    }

    summary.endTime = new Date();
    console.log(`[NeuralOrganizer] Finished organization for: ${dirPath}. Processed: ${summary.totalProcessed} files.`);
    
    return summary;
  }

  /**
   * Generates a readable text summary of the organization result, suitable for an Agent.
   * @param summary The result from organizeDirectory
   */
  public generateSummaryText(summary: OrganizeSummary): string {
    let text = `*Organization Report for ${summary.directory}*\n`;
    const durationMs = summary.endTime.getTime() - summary.startTime.getTime();
    text += `Duration: ${(durationMs / 1000).toFixed(2)} seconds\n`;
    text += `Total Files Moved: ${summary.totalProcessed}\n\n`;
    
    if (summary.totalProcessed > 0) {
      text += `*Moved by Category:*\n`;
      for (const [category, count] of Object.entries(summary.moved)) {
        text += `- ${category}: ${count} files\n`;
      }
    } else {
      text += `No files were moved (directory was already organized or empty).\n`;
    }

    if (summary.errors.length > 0) {
      text += `\n*Errors encountered (${summary.errors.length}):*\n`;
      const displayErrors = summary.errors.slice(0, 5);
      for (const err of displayErrors) {
        text += `- ${err}\n`;
      }
      if (summary.errors.length > 5) {
        text += `- ... and ${summary.errors.length - 5} more errors.\n`;
      }
    }

    return text;
  }
}
