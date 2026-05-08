import * as fs from 'node:fs';
import * as path from 'node:path';

export function readPreloadSources(): string {
  const preloadRoot = path.join(__dirname, '..', '..', 'preload');
  const modularSources = fs.readdirSync(preloadRoot)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(preloadRoot, file), 'utf-8'));

  return [
    fs.readFileSync(path.join(__dirname, '..', '..', 'preload.ts'), 'utf-8'),
    ...modularSources,
  ].join('\n');
}

export function extractAllowedChannels(source: string): string[] {
  const blocks = source.matchAll(/(?:const|export const)\s+CHANNEL_GROUP_\d+\s*=\s*\[([\s\S]*?)\]/g);
  const channels = new Set<string>();
  for (const block of blocks) {
    for (const channelMatch of block[1].matchAll(/'([^']+)'/g)) {
      channels.add(channelMatch[1]);
    }
  }
  return Array.from(channels);
}

export function extractCspContent(source: string): string {
  const match = source.match(/meta\.content\s*=\s*"([^"]+)"/);
  if (match?.[1]) return match[1];

  const arrayMatch = source.match(/meta\.content\s*=\s*\[([\s\S]*?)\]\.join/);
  if (!arrayMatch) return '';
  return Array.from(arrayMatch[1].matchAll(/"([^"]+)"/g), (item) => item[1]).join('; ');
}

export const preloadSource = readPreloadSources();
export const ALLOWED_IPC_CHANNELS = extractAllowedChannels(preloadSource);
export const CSP_CONTENT = extractCspContent(preloadSource);

export const sanitizePayload = (payload: any): any => {
  const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
  const sanitize = (value: any, depth = 0): any => {
    if (depth > 20) throw new Error('Security Violation: IPC payload is too deeply nested.');
    if (value === null || value === undefined) return value;
    if (typeof value === 'function') {
      throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.');
    }
    if (Array.isArray(value)) {
      if (value.length > 1000) throw new Error('Security Violation: IPC array payload is too large.');
      return value.map((item) => sanitize(item, depth + 1));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length > 200) throw new Error('Security Violation: IPC object payload has too many keys.');
      const safeObj: Record<string, any> = {};
      for (const [key, nestedValue] of entries) {
        if (dangerousKeys.has(key)) continue;
        safeObj[key] = sanitize(nestedValue, depth + 1);
      }
      return safeObj;
    }
    return value;
  };
  return sanitize(payload);
};

export function validateChannel(channel: string) {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
}
