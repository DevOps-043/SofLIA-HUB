import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DEFAULT_CONFIG, type WhatsAppConfig } from './types';
import { normalizeWhatsAppConfig } from './personalization';

export const AUTH_DIR = path.join(app.getPath('userData'), 'whatsapp-auth');
export const CONFIG_PATH = path.join(app.getPath('userData'), 'whatsapp-config.json');

export async function loadConfig(): Promise<WhatsAppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return normalizeWhatsAppConfig({ ...DEFAULT_CONFIG, ...JSON.parse(data) });
  } catch {
    return normalizeWhatsAppConfig(DEFAULT_CONFIG);
  }
}

export async function saveConfig(config: WhatsAppConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(normalizeWhatsAppConfig(config), null, 2), 'utf-8');
}
