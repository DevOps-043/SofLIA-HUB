import { exec } from 'node:child_process';
import os from 'node:os';
import * as si from 'systeminformation';
import type { ToolImplementation } from '../src/core/ports/tools/Tool';

/**
 * AppLauncherTool
 * Herramienta para gestionar aplicaciones de escritorio.
 * Permite abrir, cerrar y listar las aplicaciones en ejecución de forma remota (Windows/Mac/Linux).
 */
export class AppLauncherTool implements ToolImplementation {
  definition = {
    name: 'manage_applications_tool',
    description: 'Herramienta para gestionar aplicaciones. Permite abrir, cerrar y listar las aplicaciones en ejecución de forma remota en la computadora.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        action: {
          type: 'STRING',
          description: 'Acción a realizar: "list" (listar apps), "launch" (abrir app) o "close" (cerrar app).'
        },
        appName: {
          type: 'STRING',
          description: 'Nombre de la aplicación a abrir o cerrar (por ejemplo "chrome", "notepad", "calc"). Ignorado si la acción es "list".'
        }
      },
      required: ['action']
    }
  };

  async execute(args: any): Promise<any> {
    const { action, appName } = args;

    try {
      switch (action) {
        case 'list':
          return await this.getRunningApps();
        case 'launch':
          if (!appName) {
            return { success: false, error: 'Se requiere "appName" para la acción "launch".' };
          }
          return await this.launchApp(appName);
        case 'close':
          if (!appName) {
            return { success: false, error: 'Se requiere "appName" para la acción "close".' };
          }
          return await this.closeApp(appName);
        default:
          return { success: false, error: `Acción desconocida: ${action}` };
      }
    } catch (error: any) {
      return { success: false, error: `Excepción en AppLauncherTool: ${error.message}` };
    }
  }

  async getRunningApps(): Promise<any> {
    try {
      const data = await si.processes();
      // Filtrar procesos de sistema para quedarnos principalmente con las aplicaciones de usuario
      const systemProcesses = [
        'svchost.exe', 'conhost.exe', 'explorer.exe', 'System', 'Registry',
        'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe',
        'winlogon.exe', 'fontdrvhost.exe', 'dwm.exe', 'spoolsv.exe', 'Taskmgr.exe',
        'SearchUI.exe', 'sihost.exe', 'taskhostw.exe', 'RuntimeBroker.exe',
        'kernel_task', 'launchd', 'sysmond', 'WindowServer', 'systemd'
      ];

      const uniqueApps = new Map<string, any>();

      for (const p of data.list) {
        const name = p.name || '';
        if (!name) continue;

        const isSystem = systemProcesses.some(sys => name.toLowerCase() === sys.toLowerCase());
        if (isSystem) continue;

        const key = name.toLowerCase();
        // Si ya existe la app, solo guardamos la primera instancia pero nos aseguramos que sea listada
        if (!uniqueApps.has(key)) {
          uniqueApps.set(key, {
            name: name,
            pid: p.pid,
            cpu: Number((p.cpu || 0).toFixed(2)),
            memory: Number((p.mem || 0).toFixed(2))
          });
        }
      }

      // Ordenar por uso de memoria de mayor a menor y limitar a top 50 (para no desbordar el contexto)
      const apps = Array.from(uniqueApps.values())
        .sort((a, b) => b.memory - a.memory)
        .slice(0, 50);

      return {
        success: true,
        apps,
        total: apps.length,
        message: `Se encontraron ${apps.length} aplicaciones principales en ejecución.`
      };
    } catch (error: any) {
      return { success: false, error: `Error obteniendo procesos: ${error.message}` };
    }
  }

  async launchApp(name: string): Promise<any> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let cmd = '';

      if (platform === 'win32') {
        cmd = `start "" "${name}"`;
      } else if (platform === 'darwin') {
        cmd = `open -a "${name}"`;
      } else {
        cmd = `xdg-open "${name}"`;
      }

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // Fallback para Windows por si el ejecutable necesita lanzarse directamente sin "" iniciales o usando la ruta del sistema
          if (platform === 'win32') {
            exec(`start ${name}`, (err2) => {
              if (err2) {
                resolve({ success: false, error: `No se pudo abrir ${name}: ${error.message}` });
              } else {
                resolve({ success: true, message: `Aplicación "${name}" abierta exitosamente (vía fallback).` });
              }
            });
            return;
          }
          resolve({ success: false, error: `Error al abrir ${name}: ${error.message}` });
        } else {
          resolve({ success: true, message: `Aplicación "${name}" abierta exitosamente.`, stdout, stderr });
        }
      });
    });
  }

  async closeApp(name: string): Promise<any> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let cmd = '';

      if (platform === 'win32') {
        // Asegurar que termina en .exe para un cierre seguro en Windows con taskkill
        const exeName = name.toLowerCase().endsWith('.exe') ? name : `${name}.exe`;
        cmd = `taskkill /IM "${exeName}" /F`;
      } else {
        cmd = `pkill -f "${name}"`;
      }

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // Intentar sin el sufijo .exe en Windows si falló (por si la app no tiene esa extensión en memoria)
          if (platform === 'win32' && !name.toLowerCase().endsWith('.exe')) {
            exec(`taskkill /IM "${name}" /F`, (err2) => {
              if (err2) {
                resolve({ success: false, error: `No se pudo encontrar o cerrar la aplicación ${name}.` });
              } else {
                resolve({ success: true, message: `Aplicación "${name}" cerrada exitosamente (vía fallback).` });
              }
            });
            return;
          }
          resolve({ success: false, error: `Error al cerrar ${name}: No se pudo encontrar o terminar el proceso.` });
        } else {
          resolve({ success: true, message: `Aplicación "${name}" cerrada exitosamente.`, stdout, stderr });
        }
      });
    });
  }
}
