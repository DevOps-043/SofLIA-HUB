import { app as electronApp } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserTaskArtifacts } from './types';

export function getBrowserWebArtifactsBaseDir(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'computer-use', 'browser-web');
  } catch {
    return path.join(process.cwd(), 'computer-use-artifacts', 'browser-web');
  }
}

export function getBrowserWebProfilesBaseDir(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'computer-use', 'browser-web-profiles');
  } catch {
    return path.join(process.cwd(), 'computer-use-artifacts', 'browser-web-profiles');
  }
}

export function sanitizeBrowserProfileId(profileId: string): string {
  const cleaned = String(profileId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned || 'default';
}

export function resolveBrowserProfileId(profileId?: string): string {
  return sanitizeBrowserProfileId(profileId || 'default');
}

export function getBrowserProfileDirectory(profileId: string): string {
  return path.join(getBrowserWebProfilesBaseDir(), resolveBrowserProfileId(profileId));
}

function sanitizeBrowserTaskLabel(task: string): string {
  const cleaned = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned || 'task';
}

export function createBrowserTaskArtifacts(task: string): BrowserTaskArtifacts {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const taskId = `browser-${Date.now().toString(36)}`;
  const runDirectory = path.join(
    getBrowserWebArtifactsBaseDir(),
    `${stamp}-${sanitizeBrowserTaskLabel(task)}`,
  );

  fs.mkdirSync(runDirectory, { recursive: true });

  return {
    taskId,
    runDirectory,
    tracePath: path.join(runDirectory, 'trace.zip'),
    reportPath: path.join(runDirectory, 'report.json'),
    finalScreenshotPath: path.join(runDirectory, 'final.png'),
  };
}

export async function startBrowserTaskTrace(context: any): Promise<{ success: boolean; error: string | null }> {
  if (!context?.tracing) {
    return { success: false, error: 'Tracing de Playwright no disponible.' };
  }

  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'No se pudo iniciar el trace de Playwright.' };
  }
}
