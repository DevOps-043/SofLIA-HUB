import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoredEmailConfig {
  defaultFrom: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

const EMAIL_CONFIG_PATH = path.join(app.getPath('userData'), 'email-config.json');

function encryptPassword(password: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El almacenamiento seguro del sistema no esta disponible.');
  }
  return safeStorage.encryptString(password).toString('base64');
}

function decryptPassword(config: any): string {
  if (typeof config.passwordEncrypted === 'string' && config.passwordEncrypted) {
    return safeStorage.decryptString(Buffer.from(config.passwordEncrypted, 'base64'));
  }
  if (typeof config.password === 'string') return config.password;
  throw new Error('La configuracion de email no contiene credenciales validas.');
}

export async function writeEmailConfig(input: StoredEmailConfig): Promise<void> {
  const config = {
    host: input.host,
    port: input.port,
    user: input.user,
    defaultFrom: input.defaultFrom,
    passwordEncrypted: encryptPassword(input.password),
    passwordStorage: 'safeStorage',
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(EMAIL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function readEmailConfig(): Promise<StoredEmailConfig> {
  const config = JSON.parse(await fs.readFile(EMAIL_CONFIG_PATH, 'utf-8'));
  return {
    host: String(config.host || ''),
    port: Number(config.port || 587),
    user: String(config.user || ''),
    defaultFrom: String(config.defaultFrom || config.user || ''),
    password: decryptPassword(config),
  };
}

export async function getEmailConfigStatus(): Promise<{ success: boolean; configured: boolean; email?: string }> {
  try {
    const config = JSON.parse(await fs.readFile(EMAIL_CONFIG_PATH, 'utf-8'));
    return { success: true, configured: true, email: String(config.user || '') };
  } catch {
    return { success: true, configured: false };
  }
}
