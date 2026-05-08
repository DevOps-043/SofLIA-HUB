import { exec } from 'node:child_process';
import os from 'node:os';

export async function launchApp(name: string): Promise<any> {
  return new Promise((resolve) => {
    const safeName = validateApplicationName(name);
    if (!safeName) {
      resolve({ success: false, error: 'Nombre de aplicacion invalido o inseguro.' });
      return;
    }
    const platform = os.platform();
    const cmd = getLaunchCommand(platform, safeName);

    exec(cmd, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, message: `Aplicacion "${safeName}" abierta exitosamente.`, stdout, stderr });
        return;
      }

      if (platform === 'win32') {
        exec(getLaunchCommand(platform, safeName), (fallbackError) => {
          resolve(fallbackError
            ? { success: false, error: `No se pudo abrir ${safeName}: ${error.message}` }
            : { success: true, message: `Aplicacion "${safeName}" abierta exitosamente via fallback.` });
        });
        return;
      }

      resolve({ success: false, error: `Error al abrir ${safeName}: ${error.message}` });
    });
  });
}

export async function closeApp(name: string): Promise<any> {
  return new Promise((resolve) => {
    const safeName = validateApplicationName(name);
    if (!safeName) {
      resolve({ success: false, error: 'Nombre de aplicacion invalido o inseguro.' });
      return;
    }
    const platform = os.platform();
    const cmd = getCloseCommand(platform, safeName);

    exec(cmd, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, message: `Aplicacion "${safeName}" cerrada exitosamente.`, stdout, stderr });
        return;
      }

      if (platform === 'win32' && !safeName.toLowerCase().endsWith('.exe')) {
        exec(`taskkill /IM "${safeName}" /F`, (fallbackError) => {
          resolve(fallbackError
            ? { success: false, error: `No se pudo encontrar o cerrar la aplicacion ${safeName}.` }
            : { success: true, message: `Aplicacion "${safeName}" cerrada exitosamente via fallback.` });
        });
        return;
      }

      resolve({ success: false, error: `Error al cerrar ${safeName}: No se pudo encontrar o terminar el proceso.` });
    });
  });
}

function validateApplicationName(value: string): string | null {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 260) return null;
  if (/[\r\n\u0000-\u001F\u007F"`|&;<>()]/.test(normalized)) return null;
  return normalized;
}

function getLaunchCommand(platform: NodeJS.Platform, name: string): string {
  if (platform === 'win32') return `start "" "${name}"`;
  if (platform === 'darwin') return `open -a "${name}"`;
  return `xdg-open "${name}"`;
}

function getCloseCommand(platform: NodeJS.Platform, name: string): string {
  if (platform !== 'win32') return `pkill -f "${name}"`;
  const exeName = name.toLowerCase().endsWith('.exe') ? name : `${name}.exe`;
  return `taskkill /IM "${exeName}" /F`;
}
