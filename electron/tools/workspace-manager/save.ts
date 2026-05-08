import fs from 'fs/promises';
import { execAsync } from './exec';
import { getWorkspacePath } from './paths';
import type { SavedWorkspaceApp } from './types';

const IGNORED_PROCESS_NAMES = new Set([
  'TextInputHost',
  'ApplicationFrameHost',
  'SystemSettings',
  'explorer',
  'Taskmgr',
]);

export async function saveWorkspace(name: string): Promise<string> {
  try {
    const cmd = 'powershell -command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Name, MainWindowTitle, Path | ConvertTo-Json -Compress"';
    const { stdout } = await execAsync(cmd);
    if (!stdout || stdout.trim() === '') return `No se encontraron aplicaciones abiertas para guardar en el espacio '${name}'.`;

    const apps = normalizeProcessOutput(stdout).filter(isWorkspaceApp);
    await fs.writeFile(getWorkspacePath(name), JSON.stringify(apps, null, 2), 'utf-8');

    const appNames = apps.map((app) => app.Name).join(', ');
    return `Espacio de trabajo '${name}' guardado correctamente.\nSe guardaron ${apps.length} aplicaciones: ${appNames}.`;
  } catch (error: any) {
    return `Error al guardar el espacio de trabajo: ${error.message}`;
  }
}

function normalizeProcessOutput(stdout: string): SavedWorkspaceApp[] {
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function isWorkspaceApp(app: SavedWorkspaceApp): boolean {
  return Boolean(app?.Name && app.MainWindowTitle && !IGNORED_PROCESS_NAMES.has(app.Name));
}
