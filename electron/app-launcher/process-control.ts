import { exec } from 'node:child_process';
import os from 'node:os';

export async function launchApp(name: string): Promise<any> {
  return new Promise((resolve) => {
    const platform = os.platform();
    const cmd = getLaunchCommand(platform, name);

    exec(cmd, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, message: `Aplicacion "${name}" abierta exitosamente.`, stdout, stderr });
        return;
      }

      if (platform === 'win32') {
        exec(`start ${name}`, (fallbackError) => {
          resolve(fallbackError
            ? { success: false, error: `No se pudo abrir ${name}: ${error.message}` }
            : { success: true, message: `Aplicacion "${name}" abierta exitosamente via fallback.` });
        });
        return;
      }

      resolve({ success: false, error: `Error al abrir ${name}: ${error.message}` });
    });
  });
}

export async function closeApp(name: string): Promise<any> {
  return new Promise((resolve) => {
    const platform = os.platform();
    const cmd = getCloseCommand(platform, name);

    exec(cmd, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, message: `Aplicacion "${name}" cerrada exitosamente.`, stdout, stderr });
        return;
      }

      if (platform === 'win32' && !name.toLowerCase().endsWith('.exe')) {
        exec(`taskkill /IM "${name}" /F`, (fallbackError) => {
          resolve(fallbackError
            ? { success: false, error: `No se pudo encontrar o cerrar la aplicacion ${name}.` }
            : { success: true, message: `Aplicacion "${name}" cerrada exitosamente via fallback.` });
        });
        return;
      }

      resolve({ success: false, error: `Error al cerrar ${name}: No se pudo encontrar o terminar el proceso.` });
    });
  });
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
