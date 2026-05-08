import fs from 'node:fs';
import { WINDOWS_BROWSER_CANDIDATES } from './constants';
import type { BrowserTaskOptions } from './types';
import type { PlaywrightModule } from './service-types';

export async function ensureBrowserPage(service: any, options?: BrowserTaskOptions): Promise<any> {
  const requestedProfileMode = options?.isolated ? 'isolated' : 'persistent';
  const requestedProfileId = service.resolveProfileId(options?.profileId);
  const modeChanged = service.currentProfileMode !== requestedProfileMode;
  const profileChanged = requestedProfileMode === 'persistent' && service.currentProfileId !== requestedProfileId;
  if (modeChanged || profileChanged) await service.disposeBrowserResources();
  const existingPage = service.page && !service.page.isClosed() ? service.page : null;
  if (existingPage) {
    service.currentProfileId = requestedProfileMode === 'persistent' ? requestedProfileId : null;
    service.currentProfileMode = requestedProfileMode;
    await existingPage.bringToFront().catch(() => {});
    return existingPage;
  }
  const playwright = await service.getPlaywright();
  if (requestedProfileMode === 'persistent') {
    service.context = await service.launchPersistentContext(playwright, requestedProfileId);
    service.browser = null;
    service.currentProfileId = requestedProfileId;
    service.currentProfileMode = 'persistent';
  } else {
    if (!service.browser) service.browser = await service.launchBrowser(playwright);
    if (!service.context) service.context = await service.browser.newContext({ viewport: { width: 1440, height: 960 }, ignoreHTTPSErrors: true });
    service.currentProfileId = null;
    service.currentProfileMode = 'isolated';
  }
  const existingContextPage = service.context?.pages?.().find((candidate: any) => !candidate.isClosed?.());
  service.page = existingContextPage || await service.context.newPage();
  await service.page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await service.page.bringToFront().catch(() => {});
  return service.page;
}

export async function disposeBrowserResources(service: any): Promise<void> {
  try {
    if (service.page && !service.page.isClosed()) await service.page.close().catch(() => {});
  } finally {
    service.page = null;
  }
  try {
    if (service.context) await service.context.close().catch(() => {});
  } finally {
    service.context = null;
  }
  try {
    if (service.browser) await service.browser.close().catch(() => {});
  } finally {
    service.browser = null;
    service.currentProfileId = null;
    service.currentProfileMode = null;
  }
}

export async function launchBrowser(playwright: PlaywrightModule): Promise<any> {
  let lastError: Error | null = null;
  for (const candidate of WINDOWS_BROWSER_CANDIDATES) {
    try {
      if ('executablePath' in candidate && candidate.executablePath && !fs.existsSync(candidate.executablePath)) continue;
      return await playwright.chromium.launch({
        headless: false,
        channel: 'channel' in candidate ? candidate.channel : undefined,
        executablePath: 'executablePath' in candidate ? candidate.executablePath : undefined,
        args: ['--start-maximized'],
      });
    } catch (err: any) {
      lastError = err;
    }
  }
  throw new Error(`No se pudo iniciar un browser compatible con Playwright. ${lastError?.message || ''}`.trim());
}

export async function launchPersistentContext(service: any, playwright: PlaywrightModule, profileId: string): Promise<any> {
  let lastError: Error | null = null;
  const profilePath = service.getProfileDirectory(profileId);
  fs.mkdirSync(profilePath, { recursive: true });
  for (const candidate of WINDOWS_BROWSER_CANDIDATES) {
    try {
      if ('executablePath' in candidate && candidate.executablePath && !fs.existsSync(candidate.executablePath)) continue;
      return await playwright.chromium.launchPersistentContext(profilePath, {
        headless: false,
        channel: 'channel' in candidate ? candidate.channel : undefined,
        executablePath: 'executablePath' in candidate ? candidate.executablePath : undefined,
        viewport: { width: 1440, height: 960 },
        ignoreHTTPSErrors: true,
        args: ['--start-maximized'],
      });
    } catch (err: any) {
      lastError = err;
    }
  }
  throw new Error(`No se pudo iniciar un browser persistente compatible con Playwright. ${lastError?.message || ''}`.trim());
}
