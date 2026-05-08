import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL } from './constants';
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
    getGenAI() {
      if (!this.apiKey) throw new Error('API key de Gemini no configurada.');
      if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.apiKey);
      return this.genAI;
    },
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
    shouldNavigateToStartUrl(page: any, startUrl: string) {
      return normalizeComparableUrl(page.url?.() || '') !== normalizeComparableUrl(startUrl);
    },
    collectSnapshot(page: any) {
      return collectBrowserPageSnapshot(page);
    },
    decideNextAction(task: string, snapshot: BrowserPageSnapshot, history: BrowserHistoryEntry[]) {
      return decideNextBrowserAction(this, task, snapshot, history);
    },
    executeAction(page: any, action: BrowserActionPayload) {
      return executeBrowserAction(page, action);
    },
  } satisfies BrowserWebEngineApi & ThisType<any>);
}

async function decideNextBrowserAction(
  service: any,
  task: string,
  snapshot: BrowserPageSnapshot,
  history: BrowserHistoryEntry[],
): Promise<BrowserActionPayload> {
  const prompt = buildBrowserActionPrompt(task, snapshot, history);
  const parts: any[] = snapshot.screenshotBase64
    ? [{ inlineData: { mimeType: 'image/png', data: snapshot.screenshotBase64 } }, { text: prompt }]
    : [{ text: prompt }];

  for (const modelId of [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]) {
    try {
      const model = service.getGenAI().getGenerativeModel({ model: modelId });
      const result = await model.generateContent(parts);
      return parseBrowserAction(result.response.text());
    } catch (err: any) {
      if (modelId === DEFAULT_FALLBACK_MODEL) throw err;
    }
  }
  throw new Error('No se pudo obtener una accion del modelo para browser_web.');
}
