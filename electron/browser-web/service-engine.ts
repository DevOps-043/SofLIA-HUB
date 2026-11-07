import { generateSessionText } from '../ai-provider/text';
import type { Page } from 'playwright-core';
import type { BrowserWebService } from '../browser-web-service';
import { assertBackendTaskActive, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { executeBrowserAction } from './action-executor';
import { parseBrowserAction } from './action-parser';
import { normalizeComparableUrl } from './normalizers';
import { buildBrowserActionPrompt } from './prompts';
import { collectBrowserPageSnapshot } from './snapshot-collector';
import {
  disposeBrowserResources,
  ensureBrowserPage,
  launchBrowser,
  launchPersistentContext,
} from './service-page';
import type { BrowserActionPayload, BrowserHistoryEntry, BrowserPageSnapshot, BrowserTaskOptions } from './types';
import type { BrowserWebConstructor, BrowserWebEngineApi, PlaywrightModule } from './service-types';

export function attachBrowserWebEngine(Service: BrowserWebConstructor): void {
  Object.assign(Service.prototype, {
    async getPlaywright() {
      if (!this.playwright) this.playwright = await import('playwright-core');
      return this.playwright;
    },
    ensurePage(options?: BrowserTaskOptions) {
      return ensureBrowserPage(this, options);
    },
    disposeBrowserResources() {
      return disposeBrowserResources(this);
    },
    launchBrowser(playwright: PlaywrightModule) {
      return launchBrowser(playwright);
    },
    launchPersistentContext(playwright: PlaywrightModule, profileId: string) {
      return launchPersistentContext(this, playwright, profileId);
    },
    shouldNavigateToStartUrl(page: Page, startUrl: string) {
      return normalizeComparableUrl(page.url?.() || '') !== normalizeComparableUrl(startUrl);
    },
    collectSnapshot(page: Page, signal?: AbortSignal) {
      return collectBrowserPageSnapshot(page, signal);
    },
    decideNextAction(task: string, snapshot: BrowserPageSnapshot, history: BrowserHistoryEntry[], signal?: AbortSignal) {
      return decideNextBrowserAction(this, task, snapshot, history, signal);
    },
    executeAction(page: Page, action: BrowserActionPayload, signal?: AbortSignal) {
      return executeBrowserAction(page, action, signal);
    },
  } satisfies BrowserWebEngineApi & ThisType<BrowserWebService>);
}

async function decideNextBrowserAction(
  _service: BrowserWebService,
  task: string,
  snapshot: BrowserPageSnapshot,
  history: BrowserHistoryEntry[],
  signal?: AbortSignal,
): Promise<BrowserActionPayload> {
  const prompt = buildBrowserActionPrompt(task, snapshot, history);
  assertBackendTaskActive(signal);
  let text: string;
  try { text = await runBackendTaskStage(signal, () => generateSessionText(prompt, {
    json: true, signal, images: snapshot.screenshotBase64 ? [`data:image/png;base64,${snapshot.screenshotBase64}`] : [],
  })); } finally { assertBackendTaskActive(signal); }
  return parseBrowserAction(text);
}
