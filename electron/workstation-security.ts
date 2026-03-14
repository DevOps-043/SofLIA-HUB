import { spawn } from 'node:child_process';
import os from 'node:os';
import { createRequire } from 'node:module';
import { z } from 'zod';

// systeminformation: CJS module loaded via require() to avoid ESM↔CJS interop crash
const _require = createRequire(import.meta.url);
const si = _require('systeminformation') as typeof import('systeminformation');

export class WorkstationController {
  
  /**
   * Bloquea la pantalla de la computadora.
   * Ejecuta el comando nativo equivalente según el SO.
   */
  async lockScreen(): Promise<void> {
    const platform = os.platform();
    return new Promise((resolve, reject) => {
      try {
        if (platform === 'win32') {
          const child = spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else if (platform === 'darwin') {
          const child = spawn('pmset', ['displaysleepnow'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else {
          // Linux fallback
          const child = spawn('xdg-screensaver', ['lock'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Pone la computadora en modo de suspensión (sleep).
   */
  async sleep(): Promise<void> {
    const platform = os.platform();
    return new Promise((resolve, reject) => {
      try {
        if (platform === 'win32') {
          // Suspende usando Powrprof
          const child = spawn('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else if (platform === 'darwin') {
          const child = spawn('pmset', ['sleepnow'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else {
          // Linux fallback
          const child = spawn('systemctl', ['suspend'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Silencia el volumen del sistema o invierte su estado.
   */
  async muteVolume(): Promise<void> {
    const platform = os.platform();
    return new Promise((resolve, reject) => {
      try {
        if (platform === 'win32') {
          // Usa PowerShell para simular la tecla Volume Mute (173)
          const psCmd = `(New-Object -ComObject WScript.Shell).SendKeys([char]173)`;
          const child = spawn('powershell.exe', ['-NoProfile', '-Command', psCmd], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else if (platform === 'darwin') {
          const child = spawn('osascript', ['-e', 'set volume with output muted'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        } else {
          // Linux fallback
          const child = spawn('amixer', ['-D', 'pulse', 'sset', 'Master', 'mute'], { stdio: 'ignore' });
          child.on('close', () => resolve());
          child.on('error', reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retorna un resumen formateado de la salud del sistema (CPU, RAM, Disco).
   */
  async getHealth(): Promise<Record<string, any>> {
    try {
      const [cpu, mem, fsSize] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize()
      ]);

      const mainDisk = fsSize.find((disk: any) => disk.mount === '/' || disk.mount === 'C:') || fsSize[0];
      
      const totalMemGB = (mem.total / (1024 ** 3)).toFixed(2);
      const usedMemGB = (mem.active / (1024 ** 3)).toFixed(2);
      const memPercent = ((mem.active / mem.total) * 100).toFixed(1);

      let diskInfo = 'Desconocido';
      if (mainDisk) {
        const totalDiskGB = (mainDisk.size / (1024 ** 3)).toFixed(2);
        const usedDiskGB = (mainDisk.used / (1024 ** 3)).toFixed(2);
        diskInfo = `${usedDiskGB} GB / ${totalDiskGB} GB (${mainDisk.use}%)`;
      }

      const uptimeHours = (os.uptime() / 3600).toFixed(1);

      return {
        cpu: {
          modelo: `${cpu.manufacturer} ${cpu.brand}`,
          nucleos: cpu.cores,
          velocidad: `${cpu.speed} GHz`
        },
        memoria: {
          total: `${totalMemGB} GB`,
          enUso: `${usedMemGB} GB`,
          porcentaje: `${memPercent}%`
        },
        discoPrincipal: diskInfo,
        plataforma: `${os.platform()} ${os.release()}`,
        tiempoActivo: `${uptimeHours} horas`,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      throw new Error(`Error obteniendo métricas de salud: ${err.message}`);
    }
  }
}

/**
 * Esquema Zod para validar los argumentos de la herramienta workstation_control.
 */
export const workstationControlSchema = z.object({
  action: z.enum(['lock', 'sleep', 'mute', 'health']).describe('La acción a ejecutar: "lock" (bloquear pantalla), "sleep" (suspender PC), "mute" (silenciar volumen) o "health" (ver métricas de salud del sistema).')
});

/**
 * Declaración de herramienta compatible con la arquitectura de AutoDev y agentes IA.
 * Proporciona control remoto sobre el hardware y métricas de salud del sistema.
 */
export const workstation_control = {
  name: 'workstation_control',
  description: 'Controla remotamente el hardware de la estación de trabajo y obtiene métricas de salud. Permite bloquear la pantalla, suspender el equipo, silenciar el volumen o revisar el estado del sistema (CPU, RAM, Disco).',
  parameters: workstationControlSchema,
  execute: async (args: z.infer<typeof workstationControlSchema>) => {
    const controller = new WorkstationController();
    
    try {
      switch (args.action) {
        case 'lock':
          await controller.lockScreen();
          return { success: true, message: 'La pantalla ha sido bloqueada exitosamente.' };
          
        case 'sleep':
          await controller.sleep();
          return { success: true, message: 'El equipo ha sido puesto en modo suspensión.' };
          
        case 'mute':
          await controller.muteVolume();
          return { success: true, message: 'El volumen del sistema ha sido silenciado o alternado.' };
          
        case 'health':
          const healthData = await controller.getHealth();
          return { success: true, data: healthData };
          
        default:
          return { success: false, error: `Acción no soportada: ${args.action}` };
      }
    } catch (error: any) {
      return { success: false, error: `Error al ejecutar la acción '${args.action}': ${error.message}` };
    }
  }
};
