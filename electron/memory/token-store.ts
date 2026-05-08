import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function getTokenPath(serviceName: string): string {
  return path.join(app.getPath('userData'), `${serviceName}-token.enc`);
}

export function saveMemoryToken(serviceName: string, token: string): void {
  const tokenPath = getTokenPath(serviceName);
  try {
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(tokenPath, safeStorage.encryptString(token));
    } else {
      fs.writeFileSync(tokenPath, token, 'utf8');
    }
    console.log(`[MemoryService] Token safely saved for ${serviceName}`);
  } catch (err: any) {
    console.error(`[MemoryService] saveToken error for ${serviceName}:`, err.message);
  }
}

export function getMemoryToken(serviceName: string): string | null {
  const tokenPath = getTokenPath(serviceName);
  if (!fs.existsSync(tokenPath)) return null;

  try {
    const data = fs.readFileSync(tokenPath);
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(data);
      } catch {
        return data.toString('utf8');
      }
    }
    return data.toString('utf8');
  } catch (err: any) {
    console.error(`[MemoryService] getToken error for ${serviceName}:`, err.message);
    return null;
  }
}

export function deleteMemoryToken(serviceName: string): boolean {
  const tokenPath = getTokenPath(serviceName);
  if (!fs.existsSync(tokenPath)) return false;

  try {
    fs.unlinkSync(tokenPath);
    return true;
  } catch (err: any) {
    console.error(`[MemoryService] deleteToken error for ${serviceName}:`, err.message);
    return false;
  }
}
