import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ProjectHubSession } from './types';

const FILE_NAME = 'project-hub-session.enc';
const sessionPath = () => path.join(app.getPath('userData'), FILE_NAME);

export function saveProjectHubSession(session: ProjectHubSession): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[ProjectHub] safeStorage no está disponible; la sesión no se persistirá.');
    return false;
  }
  try {
    const persisted = JSON.stringify({ refreshToken: session.refreshToken, workspaces: session.workspaces });
    fs.writeFileSync(sessionPath(), safeStorage.encryptString(persisted), { mode: 0o600 });
    return true;
  } catch (error) {
    console.warn('[ProjectHub] No se pudo persistir la sesión:', describe(error));
    return false;
  }
}

export function readProjectHubSession(): Pick<ProjectHubSession, 'refreshToken' | 'workspaces'> | null {
  const target = sessionPath();
  if (!fs.existsSync(target) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(target))) as Record<string, unknown>;
    if (typeof parsed.refreshToken !== 'string' || !Array.isArray(parsed.workspaces)) return null;
    return { refreshToken: parsed.refreshToken, workspaces: parsed.workspaces as ProjectHubSession['workspaces'] };
  } catch {
    console.warn('[ProjectHub] La sesión cifrada no se pudo leer.');
    return null;
  }
}

export function clearProjectHubSession(): void {
  try { if (fs.existsSync(sessionPath())) fs.unlinkSync(sessionPath()); } catch (error) {
    console.warn('[ProjectHub] No se pudo borrar la sesión:', describe(error));
  }
}

function describe(error: unknown): string { return error instanceof Error ? error.message : String(error); }

