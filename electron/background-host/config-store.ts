import type { App } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import { createDefaultBackgroundHostConfig } from './defaults';
import { getConfigPath } from './paths';
import type { BackgroundHostConfig } from './types';

export async function loadBackgroundHostConfig(app: App): Promise<BackgroundHostConfig> {
  const configPath = getConfigPath(app);
  try {
    if (!fsSync.existsSync(configPath)) {
      const defaultConfig = createDefaultBackgroundHostConfig();
      await saveBackgroundHostConfig(app, defaultConfig);
      return defaultConfig;
    }

    const parsed = JSON.parse(await fs.readFile(configPath, 'utf8')) as Partial<BackgroundHostConfig>;
    const defaultConfig = createDefaultBackgroundHostConfig();
    return {
      ...defaultConfig,
      ...parsed,
      launchArgs: Array.isArray(parsed.launchArgs) && parsed.launchArgs.length > 0
        ? parsed.launchArgs.map((value) => String(value))
        : defaultConfig.launchArgs,
    };
  } catch (error: any) {
    const fallback = {
      ...createDefaultBackgroundHostConfig(),
      lastError: `No se pudo leer la configuracion del background host: ${error?.message || String(error)}`,
    };
    await saveBackgroundHostConfig(app, fallback);
    return fallback;
  }
}

export async function saveBackgroundHostConfig(app: App, config: BackgroundHostConfig): Promise<void> {
  const configPath = getConfigPath(app);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}
