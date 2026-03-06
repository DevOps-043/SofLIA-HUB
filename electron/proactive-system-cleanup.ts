import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

export class SystemCleanupService extends EventEmitter {
  private config: CleanupConfig;
  private intervalId?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private lastCheck?: Date;
  
  private filesToClean: string[] = [];
  private totalBytesFound: number = 0;

  constructor(config: CleanupConfig = {}) {
    super();
    this.config = {
      checkIntervalMs: config.checkIntervalMs || 24 * 60 * 60 * 1000, // 24 horas
      sizeThresholdBytes: config.sizeThresholdBytes || 5 * 1024 * 1024 * 1024, // 5GB
      ageThresholdDays: config.ageThresholdDays || 30, // 30 días
    };
  }

  async init(): Promise<void> {
    console.log('[SystemCleanupService] Inicializando servicio de limpieza proactiva...');
  }

  async start(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startMonitoring();
    
    console.log('[SystemCleanupService] Monitoreo iniciado');
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isMonitoring = false;
    console.log('[SystemCleanupService] Monitoreo detenido');
  }

  getStatus(): CleanupStatus {
    return {
      isMonitoring: this.isMonitoring,
      lastCheck: this.lastCheck,
      bytesFound: this.totalBytesFound,
      filesToClean: this.filesToClean
    };
  }

  getConfig(): CleanupConfig {
    return this.config;
  }

  private startMonitoring(): void {
    // Realizar primer chequeo al iniciar
    this.checkDirectories().catch(err => {
      console.error('[SystemCleanupService] Error en chequeo inicial:', err);
    });

    // Configurar el intervalo de 24 horas
    this.intervalId = setInterval(() => {
      this.checkDirectories().catch(err => {
        console.error('[SystemCleanupService] Error en chequeo periódico:', err);
      });
    }, this.config.checkIntervalMs);
  }

  private async checkDirectories(): Promise<void> {
    this.lastCheck = new Date();
    this.filesToClean = [];
    this.totalBytesFound = 0;

    const directoriesToCheck = [
      path.join(os.homedir(), 'Downloads'),
      os.tmpdir()
    ];

    let totalSize = 0;
    const oldFiles: { filepath: string; size: number }[] = [];
    const now = Date.now();
    const ageThresholdMs = (this.config.ageThresholdDays || 30) * 24 * 60 * 60 * 1000;

    for (const dir of directoriesToCheck) {
      try {
        const stats = await fs.promises.stat(dir).catch(() => null);
        if (!stats || !stats.isDirectory()) continue;

        const files = await fs.promises.readdir(dir);
        
        for (const file of files) {
          const filepath = path.join(dir, file);
          try {
            const fileStat = await fs.promises.stat(filepath);
            if (fileStat.isFile()) {
              totalSize += fileStat.size;
              
              // Si el archivo es más antiguo que el umbral (30 días)
              if (now - fileStat.mtimeMs > ageThresholdMs) {
                oldFiles.push({ filepath, size: fileStat.size });
              }
            }
          } catch (e) {
            // Ignorar archivos inaccesibles o bloqueados por el sistema
          }
        }
      } catch (err) {
        console.error(`[SystemCleanupService] Error al acceder al directorio ${dir}:`, err);
      }
    }

    // Si el peso total supera el umbral (5GB por defecto)
    const threshold = this.config.sizeThresholdBytes || 5368709120;
    if (totalSize > threshold) {
      this.filesToClean = oldFiles.map(f => f.filepath);
      this.totalBytesFound = oldFiles.reduce((acc, f) => acc + f.size, 0);

      const gbTotal = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
      const gbLiberable = (this.totalBytesFound / (1024 * 1024 * 1024)).toFixed(2);
      
      // Si hay archivos para limpiar y se puede liberar al menos 1MB (evitar alertas innecesarias)
      if (this.filesToClean.length > 0 && this.totalBytesFound > 1024 * 1024) {
        const message = `🧹 Tienes ${gbTotal} GB ocupados en Descargas y Temporales. ¿Deseas que libere espacio eliminando archivos antiguos (>30 días) que ocupan ${gbLiberable} GB?`;
        
        // Emitir alerta proactiva para que el Hub o WhatsApp-Agent la envíe al usuario
        this.emit('proactive-alert', {
          type: 'system_cleanup_required',
          message,
          data: {
            totalBytes: totalSize,
            liberableBytes: this.totalBytesFound,
            fileCount: this.filesToClean.length
          }
        });
      }
    }
  }

  async executeCleanup(): Promise<{ success: boolean; bytesFreed: number; message: string }> {
    if (this.filesToClean.length === 0) {
      return { success: false, bytesFreed: 0, message: 'No hay archivos antiguos pendientes por limpiar.' };
    }

    let freed = 0;
    let deletedCount = 0;

    for (const filepath of this.filesToClean) {
      try {
        const stat = await fs.promises.stat(filepath);
        await fs.promises.unlink(filepath);
        freed += stat.size;
        deletedCount++;
      } catch (err) {
        console.error(`[SystemCleanupService] Error al eliminar el archivo ${filepath}:`, err);
      }
    }

    const gbFreed = (freed / (1024 * 1024 * 1024)).toFixed(2);
    const message = `✅ Limpieza inteligente completada. Se eliminaron ${deletedCount} archivos y se recuperaron ${gbFreed} GB de espacio.`;
    
    // Limpiar estado interno tras ejecutar la limpieza
    this.filesToClean = [];
    this.totalBytesFound = 0;

    // Emitir mensaje de confirmación para notificar al sistema/WhatsApp
    this.emit('cleanup-completed', {
      success: true,
      bytesFreed: freed,
      deletedCount,
      message
    });

    return { success: true, bytesFreed: freed, message };
  }
}
