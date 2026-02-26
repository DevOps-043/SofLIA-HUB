/**
 * SystemGuardianService — Watchdog Autónomo y Auto-Healing
 * Monitoriza recursos del sistema y ejecuta acciones correctivas
 * automáticamente (ej. liberar disco, matar procesos pesados).
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cron from 'node-cron';
import { diskLayout, mem, processes, fsSize } from 'systeminformation';
import type { Systeminformation } from 'systeminformation';
import type { WhatsAppService } from './whatsapp-service';

export class SystemGuardianService extends EventEmitter {
  private waService: WhatsAppService | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private isHealingDisk = false;
  private isHealingMemory = false;

  constructor() {
    super();
  }

  /**
   * Vincula el servicio de WhatsApp para notificaciones proactivas.
   */
  public setWhatsAppService(waService: WhatsAppService): void {
    this.waService = waService;
  }

  /**
   * Inicia el monitoreo continuo con node-cron (cada 15 minutos).
   */
  public startMonitoring(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Cron job corriendo cada 15 minutos
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      console.log('[SystemGuardian] Ejecutando análisis de rutina...');
      await this.checkDiskSpace();
      await this.checkMemory();
    });

    console.log('[SystemGuardian] Monitoreo activado (cada 15 min).');
  }

  /**
   * Detiene el monitoreo activo.
   */
  public stopMonitoring(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[SystemGuardian] Monitoreo detenido.');
    }
  }

  /**
   * Verifica el espacio en disco. Si el disco principal supera
   * el 90% de uso, invoca autoHealDisk.
   */
  public async checkDiskSpace(): Promise<void> {
    try {
      // Requisito: Importar y usar diskLayout (informa los discos físicos)
      const disks: Systeminformation.DiskLayoutData[] = await diskLayout();
      const mainDisk = disks[0];
      if (mainDisk) {
        console.log(`[SystemGuardian] Disco físico principal: ${mainDisk.name} (${Math.round(mainDisk.size / 1e9)} GB)`);
      }

      // Usamos fsSize para obtener el porcentaje de uso de las particiones
      const partitions: Systeminformation.FsSizeData[] = await fsSize();
      
      // Buscar la partición principal (suele ser '/' en Linux/Mac o 'C:' en Windows)
      let mainPartition = partitions.find(p => p.mount === '/' || p.mount.toUpperCase().startsWith('C:'));
      
      if (!mainPartition && partitions.length > 0) {
        mainPartition = partitions[0];
      }

      if (mainPartition) {
        console.log(`[SystemGuardian] Uso del volumen ${mainPartition.mount}: ${mainPartition.use}%`);
        if (mainPartition.use > 90) {
          console.warn(`[SystemGuardian] ⚠️ Espacio crítico (${mainPartition.use}% > 90%). Iniciando auto-heal de disco...`);
          await this.autoHealDisk();
        }
      }
    } catch (err) {
      console.error('[SystemGuardian] Error al verificar espacio en disco:', err);
    }
  }

  /**
   * Libera espacio eliminando archivos temporales recursivamente.
   */
  public async autoHealDisk(): Promise<void> {
    if (this.isHealingDisk) return;
    this.isHealingDisk = true;
    
    try {
      const tmpDir = os.tmpdir();
      console.log(`[SystemGuardian] Limpiando directorio temporal: ${tmpDir}`);
      
      const files = await fs.promises.readdir(tmpDir);
      let freedBytes = 0;

      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        try {
          const size = await this.getFileSizeRecursively(filePath);
          // Limpieza iterativa forzada
          await fs.promises.rm(filePath, { recursive: true, force: true });
          freedBytes += size;
        } catch (err) {
          // Ignorar archivos en uso o bloqueados por el sistema
        }
      }

      const freedMb = (freedBytes / (1024 * 1024)).toFixed(2);
      console.log(`[SystemGuardian] Auto-healing de disco completado. Liberados ${freedMb} MB.`);
      
      if (Number(freedMb) > 0) {
        this.notifyUser(`⚠️ Auto-healing ejecutado. El disco principal estaba casi lleno. Se limpiaron archivos temporales y se liberaron ${freedMb} MB.`);
      }
    } catch (err) {
      console.error('[SystemGuardian] Error durante autoHealDisk:', err);
    } finally {
      this.isHealingDisk = false;
    }
  }

  /**
   * Verifica la memoria RAM. Si supera el 95%, identifica y
   * mata el proceso no vital que consume más RAM.
   */
  public async checkMemory(): Promise<void> {
    if (this.isHealingMemory) return;
    
    try {
      const memoryData: Systeminformation.MemData = await mem();
      const usageRatio = memoryData.used / memoryData.total;
      const percentUsed = (usageRatio * 100).toFixed(1);
      
      console.log(`[SystemGuardian] Uso de RAM: ${percentUsed}%`);

      if (usageRatio > 0.95) {
        this.isHealingMemory = true;
        console.warn(`[SystemGuardian] ⚠️ RAM crítica (${percentUsed}% > 95%). Analizando procesos pesados...`);
        
        const procs: Systeminformation.ProcessesData = await processes();
        
        // Procesos de sistema que NUNCA deben cerrarse
        const vitalProcesses = [
          'system', 'explorer.exe', 'svchost.exe', 'csrss.exe', 
          'wininit.exe', 'smss.exe', 'services.exe', 'lsass.exe', 
          'winlogon.exe', 'taskmgr.exe', 'dwm.exe', 'spoolsv.exe',
          'kernel_task', 'launchd', 'windowserver'
        ];
        
        const ourPid = process.pid;
        const parentPid = process.ppid;

        // Filtrar procesos vitales y el propio proceso de la app
        let killableProcesses = procs.list.filter(p => {
          if (p.pid === ourPid || p.pid === parentPid) return false;
          
          const nameLower = p.name.toLowerCase();
          for (const vital of vitalProcesses) {
            if (nameLower.includes(vital) || nameLower === vital) return false;
          }
          return true;
        });

        // Ordenar por consumo de memoria residente (RSS)
        killableProcesses.sort((a, b) => b.memRss - a.memRss);

        const heaviest = killableProcesses[0];

        if (heaviest) {
          const memMb = (heaviest.memRss / 1024).toFixed(2);
          console.log(`[SystemGuardian] Proceso más pesado detectado: ${heaviest.name} (PID: ${heaviest.pid}) consumiendo ${memMb} MB.`);
          
          try {
            // Matar proceso zombie o pesado
            process.kill(heaviest.pid, 'SIGKILL');
            console.log(`[SystemGuardian] Proceso terminado con éxito: ${heaviest.name}`);
            
            this.notifyUser(`⚠️ Auto-healing ejecutado. RAM estaba al ${percentUsed}%, proceso ${heaviest.name} terminado.`);
          } catch (killErr) {
            console.error(`[SystemGuardian] No se pudo terminar el proceso ${heaviest.pid}:`, killErr);
          }
        } else {
          console.log('[SystemGuardian] No se encontraron procesos seguros para terminar.');
        }
      }
    } catch (err) {
      console.error('[SystemGuardian] Error al verificar memoria:', err);
    } finally {
      this.isHealingMemory = false;
    }
  }

  /**
   * Utilidad para calcular recursivamente el tamaño de archivos o directorios.
   */
  private async getFileSizeRecursively(targetPath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(targetPath);
      if (stats.isDirectory()) {
        const entries = await fs.promises.readdir(targetPath);
        let total = 0;
        for (const entry of entries) {
          total += await this.getFileSizeRecursively(path.join(targetPath, entry));
        }
        return total;
      }
      return stats.size;
    } catch {
      return 0; // Si no se puede leer, ignorar tamaño
    }
  }

  /**
   * Notifica eventos al usuario localmente y vía WhatsApp si está configurado.
   */
  private notifyUser(message: string): void {
    this.emit('notify', message);
    
    if (this.waService && this.waService.isConnected()) {
      const status = this.waService.getStatus();
      const numbers = status.allowedNumbers || [];
      
      for (const number of numbers) {
        const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
        this.waService.sendText(jid, message).catch(err => {
          console.error('[SystemGuardian] Error enviando WhatsApp:', err);
        });
      }
    }
  }
}
