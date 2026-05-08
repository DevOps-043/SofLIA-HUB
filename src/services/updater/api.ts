import type { UpdaterStatus } from './types';

export async function checkForUpdates(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null;
  const result = await window.updater.checkForUpdates();
  if (!result.success) return null;
  return window.updater.getStatus();
}

export async function downloadUpdate(): Promise<void> {
  if (typeof window.updater === 'undefined') return;
  await window.updater.downloadUpdate();
}

export async function installUpdate(): Promise<void> {
  if (typeof window.updater === 'undefined') return;
  await window.updater.installUpdate();
}

export async function getUpdaterStatus(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null;
  return window.updater.getStatus();
}
