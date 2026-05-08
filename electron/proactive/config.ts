import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { ProactiveConfig } from './types';

const PROACTIVE_CONFIG_PATH = path.join(app.getPath('userData'), 'proactive-config.json');

export const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  enabled: true,
  notificationHours: [8, 20],
  checkIntervalMinutes: 5,
  calendarReminders: true,
  taskReminders: true,
  systemAlerts: true,
  timezoneOffset: new Date().getTimezoneOffset() / -60,
};

export function loadProactiveConfig(): ProactiveConfig {
  try {
    if (fs.existsSync(PROACTIVE_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROACTIVE_CONFIG_PATH, 'utf-8'));
      return { ...DEFAULT_PROACTIVE_CONFIG, ...data };
    }
  } catch {
    // Use defaults when the local config cannot be parsed.
  }
  return { ...DEFAULT_PROACTIVE_CONFIG };
}

export function saveProactiveConfig(config: ProactiveConfig): void {
  fs.writeFileSync(PROACTIVE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
