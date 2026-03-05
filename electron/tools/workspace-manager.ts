import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

const workspaceDir = path.join(os.homedir(), '.soflia', 'workspaces');

const workspaceSchema: any = z.object({
  action: z.enum(['save', 'restore', 'list', 'delete']).describe('Acción a realizar: "save" (guardar actual), "restore" (abrir espacio), "list" (listar espacios), "delete" (eliminar espacio)'),
  name: z.string().optional().describe('Nombre del espacio de trabajo (requerido para save, restore, delete. ej. programacion, diseno)')
});

export const workspaceManagerTool = {
  name: 'workspace_manager',
  description: 'Gestor completo de espacios de trabajo. Permite guardar el estado actual de las ventanas abiertas, restaurarlas más tarde, listar los espacios guardados o eliminarlos.',
  schema: workspaceSchema,
  handler: async (input: { action: 'save' | 'restore' | 'list' | 'delete'; name?: string }) => {
    try {
      await fs.mkdir(workspaceDir, { recursive: true });
    } catch (err) {
      // Ignorar si ya existe
    }
    
    if (input.action === 'list') {
      try {
        const files = await fs.readdir(workspaceDir);
        const workspaces = files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
          
        if (workspaces.length === 0) {
          return 'No tienes ningún espacio de trabajo guardado todavía.';
        }
        return `Espacios de trabajo disponibles:\n- ${workspaces.join('\n- ')}`;
      } catch (error: any) {
        return `Error al listar espacios: ${error.message}`;
      }
    }
    
    if (!input.name) {
      return `Error: Se requiere el parámetro 'name' para la acción '${input.action}'.`;
    }
    
    // Normalizar nombre de archivo
    const safeName = input.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filePath = path.join(workspaceDir, `${safeName}.json`);
    
    if (input.action === 'delete') {
      try {
        await fs.unlink(filePath);
        return `Espacio de trabajo '${input.name}' eliminado correctamente.`;
      } catch (error: any) {
        if (error.code === 'ENOENT') return `El espacio '${input.name}' no existe.`;
        return `Error al eliminar el espacio: ${error.message}`;
      }
    }
    
    if (input.action === 'save') {
      try {
        // En Windows, obtenemos los procesos con ventana principal
        // Usamos Compress para asegurar que genera un JSON válido
        const cmd = `powershell -command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Name, MainWindowTitle, Path | ConvertTo-Json -Compress"`;
        const { stdout } = await execAsync(cmd);
        
        if (!stdout || stdout.trim() === '') {
          return `No se encontraron aplicaciones abiertas para guardar en el espacio '${input.name}'.`;
        }
        
        let apps;
        try {
          apps = JSON.parse(stdout);
        } catch (parseError) {
          return `Error al analizar los procesos del sistema: no se pudo leer el formato.`;
        }
        
        if (!Array.isArray(apps)) {
          apps = [apps];
        }
        
        // Filtramos procesos vacíos o del sistema innecesarios
        const filteredApps = apps.filter((app: any) => 
          app && app.Name && 
          app.Name !== 'TextInputHost' && 
          app.Name !== 'ApplicationFrameHost' &&
          app.Name !== 'SystemSettings' &&
          app.Name !== 'explorer' && // Evitar abrir multiples exploradores de Windows
          app.Name !== 'Taskmgr' && // Evitar el administrador de tareas
          app.MainWindowTitle
        );
        
        await fs.writeFile(filePath, JSON.stringify(filteredApps, null, 2), 'utf-8');
        
        const appNames = filteredApps.map((a: any) => a.Name).join(', ');
        return `Espacio de trabajo '${input.name}' guardado correctamente.\nSe guardaron ${filteredApps.length} aplicaciones: ${appNames}.`;
      } catch (error: any) {
        return `Error al guardar el espacio de trabajo: ${error.message}`;
      }
    } 
    
    if (input.action === 'restore') {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const apps = JSON.parse(data);
        
        if (!Array.isArray(apps) || apps.length === 0) {
          return `El espacio de trabajo '${input.name}' está vacío.`;
        }
        
        let restoredCount = 0;
        let failedCount = 0;
        const failedApps: string[] = [];
        
        for (const app of apps) {
          try {
            if (app.Path) {
               // En Windows CMD, el primer par de comillas es el título, el segundo es la ruta al ejecutable
               await execAsync(`start "" "${app.Path}"`);
               restoredCount++;
            } else {
               // Fallback al nombre del proceso si no hay path
               await execAsync(`start ${app.Name}`);
               restoredCount++;
            }
          } catch (e) {
            failedCount++;
            failedApps.push(app.Name || 'Desconocido');
            /* Ignorar si no arranca y continuar con los demás */ 
          }
        }
        
        let resultMsg = `Espacio '${input.name}' restaurado en la PC.\nSe iniciaron ${restoredCount} aplicaciones.`;
        if (failedCount > 0) {
          resultMsg += `\nFallaron ${failedCount} aplicaciones: ${failedApps.join(', ')}.`;
        }
        return resultMsg;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return `El espacio de trabajo '${input.name}' no existe. Puedes ver los disponibles usando la acción 'list'.`;
        }
        return `Error al restaurar el espacio de trabajo: ${error.message}`;
      }
    }

    return `Acción '${input.action}' no reconocida.`;
  }
};
