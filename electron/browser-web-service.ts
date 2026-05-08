import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  createBrowserTaskArtifacts,
  getBrowserProfileDirectory,
  getBrowserWebProfilesBaseDir,
  resolveBrowserProfileId,
  sanitizeBrowserProfileId,
  startBrowserTaskTrace,
} from './browser-web/artifacts';
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  MAX_TEXT_EXCERPT,
  MAX_VISIBLE_ELEMENTS,
  WINDOWS_BROWSER_CANDIDATES,
} from './browser-web/constants';
import { executeBrowserAction, waitForBrowserPageSettled } from './browser-web/action-executor';
import { parseBrowserAction } from './browser-web/action-parser';
import {
  inferStartUrl,
  normalizeComparableUrl,
  normalizeText,
} from './browser-web/normalizers';
import { buildBrowserActionPrompt } from './browser-web/prompts';
import { verifyBrowserActionOutcome } from './browser-web/verifiers';
import type {
  BrowserActionPayload,
  BrowserElementSnapshot,
  BrowserHistoryEntry,
  BrowserPageSnapshot,
  BrowserProfileDescriptor,
  BrowserProfileMode,
  BrowserQueueEntry,
  BrowserStatusSnapshot,
  BrowserTaskArtifacts,
  BrowserTaskOptions,
  BrowserTaskStatus,
} from './browser-web/types';

type PlaywrightModule = typeof import('playwright-core');

export class BrowserWebService extends EventEmitter {
  private apiKey = '';
  private genAI: GoogleGenerativeAI | null = null;
  private playwright: PlaywrightModule | null = null;
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private status: BrowserTaskStatus = 'idle';
  private currentTask: string | null = null;
  private currentStep = 0;
  private currentMaxSteps = 0;
  private currentUrl: string | null = null;
  private currentProfileId: string | null = null;
  private currentProfileMode: BrowserProfileMode | null = null;
  private lastAction: string | null = null;
  private lastVerification: string | null = null;
  private lastTracePath: string | null = null;
  private lastReportPath: string | null = null;
  private lastScreenshotPath: string | null = null;
  private abortController: AbortController | null = null;
  private queue: BrowserQueueEntry[] = [];

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
  }

  getStatus(): BrowserStatusSnapshot {
    return {
      status: this.status,
      currentTask: this.currentTask,
      currentStep: this.currentStep,
      maxSteps: this.currentMaxSteps,
      currentUrl: this.currentUrl,
      currentProfileId: this.currentProfileId,
      currentProfileMode: this.currentProfileMode,
      lastAction: this.lastAction,
      lastVerification: this.lastVerification,
      lastTracePath: this.lastTracePath,
      lastReportPath: this.lastReportPath,
      lastScreenshotPath: this.lastScreenshotPath,
      queuedTasks: this.queue.length,
    };
  }

  isRunning(): boolean {
    return this.status !== 'idle' || this.queue.length > 0;
  }

  abortAll(): void {
    if (this.abortController) {
      this.abortController.abort();
    }

    while (this.queue.length > 0) {
      const queued = this.queue.shift();
      queued?.reject(new Error('Tarea web cancelada antes de ejecutarse.'));
    }
  }

  listProfiles(): BrowserProfileDescriptor[] {
    const profilesRoot = this.getProfilesBaseDir();
    const descriptors: BrowserProfileDescriptor[] = [];

    const pushDescriptor = (id: string, exists: boolean): void => {
      const profilePath = this.getProfileDirectory(id);
      let lastModifiedAt: string | null = null;
      if (exists) {
        try {
          lastModifiedAt = fs.statSync(profilePath).mtime.toISOString();
        } catch {
          lastModifiedAt = null;
        }
      }
      descriptors.push({
        id,
        path: profilePath,
        exists,
        lastModifiedAt,
      });
    };

    pushDescriptor('default', fs.existsSync(this.getProfileDirectory('default')));

    if (fs.existsSync(profilesRoot)) {
      for (const entry of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const id = this.sanitizeProfileId(entry.name);
        if (!id || id === 'default' || descriptors.some((item) => item.id === id)) continue;
        pushDescriptor(id, true);
      }
    }

    descriptors.sort((left, right) => left.id.localeCompare(right.id));
    return descriptors;
  }

  async resetProfile(profileId: string): Promise<{ success: boolean; profileId: string; path: string; removed: boolean }> {
    const sanitizedId = this.resolveProfileId(profileId);
    const profilePath = this.getProfileDirectory(sanitizedId);
    const isCurrentPersistentProfile = this.currentProfileMode === 'persistent' && this.currentProfileId === sanitizedId;

    if (isCurrentPersistentProfile) {
      await this.disposeBrowserResources();
    }

    let removed = false;
    if (fs.existsSync(profilePath)) {
      fs.rmSync(profilePath, { recursive: true, force: true });
      removed = true;
    }

    return {
      success: true,
      profileId: sanitizedId,
      path: profilePath,
      removed,
    };
  }

  async executeTask(task: string, options?: BrowserTaskOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada para BrowserWebService.');
    }

    if (this.status !== 'idle') {
      return new Promise<string>((resolve, reject) => {
        this.queue.push({ task, options, resolve, reject });
        this.emit('task-queued', {
          task,
          queuePosition: this.queue.length,
          backend: 'browser_web',
        });
      });
    }

    return this.executeTaskInternal(task, options);
  }

  private async executeTaskInternal(task: string, options?: BrowserTaskOptions): Promise<string> {
    const maxSteps = options?.maxSteps ?? 40;
    const taskAbort = new AbortController();
    const artifacts = this.createTaskArtifacts(task);
    const startedAt = new Date().toISOString();
    let history: BrowserHistoryEntry[] = [];
    let finalSnapshot: BrowserPageSnapshot | null = null;
    let finalStatus: 'completed' | 'failed' | 'cancelled' | 'error' = 'failed';
    let finalMessage = '';
    let traceStarted = false;
    let traceStartError: string | null = null;

    this.abortController = taskAbort;
    this.status = 'executing';
    this.currentTask = task;
    this.currentStep = 0;
    this.currentMaxSteps = maxSteps;
    this.lastAction = null;
    this.lastVerification = null;
    this.lastTracePath = null;
    this.lastReportPath = artifacts.reportPath;
    this.lastScreenshotPath = null;

    this.emit('task-started', {
      task,
      maxSteps,
      backend: 'browser_web',
      taskId: artifacts.taskId,
      runDirectory: artifacts.runDirectory,
    });

    try {
      if (options?.resetProfile) {
        await this.resetProfile(options.profileId || 'default');
      }

      const page = await this.ensurePage(options);
      const traceStartResult = await this.startTaskTrace();
      traceStarted = traceStartResult.success;
      traceStartError = traceStartResult.error;

      const startUrl = inferStartUrl(task, options?.startUrl);
      if (startUrl && this.shouldNavigateToStartUrl(page, startUrl)) {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitForBrowserPageSettled(page);
      }

      this.currentUrl = page.url();

      for (let step = 0; step < maxSteps; step++) {
        if (taskAbort.signal.aborted) {
          finalStatus = 'cancelled';
          finalMessage = 'Tarea cancelada por el usuario.';
          return finalMessage;
        }

        this.currentStep = step + 1;
        const beforeSnapshot = await this.collectSnapshot(page);
        finalSnapshot = beforeSnapshot;
        this.currentUrl = beforeSnapshot.url;
        const action = await this.decideNextAction(task, beforeSnapshot, history);
        this.lastAction = action.message || action.action;

        this.emit('step', {
          step: step + 1,
          maxSteps,
          backend: 'browser_web',
          action,
        });

        if (action.action === 'done') {
          const message = action.message || 'Tarea web completada.';
          finalStatus = 'completed';
          finalMessage = message;
          this.emit('task-completed', {
            message,
            steps: step + 1,
            backend: 'browser_web',
            taskId: artifacts.taskId,
            reportPath: artifacts.reportPath,
            tracePath: artifacts.tracePath,
            screenshotPath: artifacts.finalScreenshotPath,
          });
          return message;
        }

        if (action.action === 'fail') {
          const message = action.message || 'La tarea web no se pudo completar.';
          finalStatus = 'failed';
          finalMessage = message;
          this.emit('task-failed', {
            message,
            steps: step + 1,
            backend: 'browser_web',
            taskId: artifacts.taskId,
            reportPath: artifacts.reportPath,
            tracePath: artifacts.tracePath,
            screenshotPath: artifacts.finalScreenshotPath,
          });
          return message;
        }

        let success = false;
        let errorMessage = '';
        let verificationMessage = '';
        let afterSnapshot: BrowserPageSnapshot | null = null;

        try {
          await this.executeAction(page, action);
          afterSnapshot = await this.collectSnapshot(page);
          finalSnapshot = afterSnapshot;
          this.currentUrl = afterSnapshot.url;
          const verification = verifyBrowserActionOutcome(action, beforeSnapshot, afterSnapshot);
          success = verification.success;
          verificationMessage = verification.message;
          this.lastVerification = verification.message;

          if (!success) {
            errorMessage = verification.message;
          }
        } catch (err: any) {
          errorMessage = err.message || 'Error desconocido';
          verificationMessage = errorMessage;
          this.lastVerification = errorMessage;
        }

        const afterUrl = page.url();
        const afterTitle = await page.title().catch(() => '');
        history.push({
          step: step + 1,
          action,
          success,
          error: errorMessage || undefined,
          verification: verificationMessage || undefined,
          url: afterUrl,
          title: afterTitle,
        });

        this.emit('step-result', {
          step: step + 1,
          maxSteps,
          backend: 'browser_web',
          success,
          verification: verificationMessage,
          action,
        });

        if (!success) {
          const recentFailures = history.slice(-3).filter((entry) => !entry.success).length;
          if (recentFailures >= 3) {
            const failureMessage = `Fallo persistente en browser_web: ${errorMessage || 'sin detalle'}`;
            finalStatus = 'failed';
            finalMessage = failureMessage;
            this.emit('task-failed', {
              message: failureMessage,
              steps: step + 1,
              backend: 'browser_web',
              taskId: artifacts.taskId,
              reportPath: artifacts.reportPath,
              tracePath: artifacts.tracePath,
              screenshotPath: artifacts.finalScreenshotPath,
            });
            return failureMessage;
          }
        }
      }

      const lastMessage = history[history.length - 1]?.action.message || 'Sin resultado final.';
      const timeoutMessage = `Se alcanzo el limite de pasos del backend web. ${lastMessage}`;
      finalStatus = 'failed';
      finalMessage = timeoutMessage;
      this.emit('task-failed', {
        message: timeoutMessage,
        steps: maxSteps,
        backend: 'browser_web',
        taskId: artifacts.taskId,
        reportPath: artifacts.reportPath,
        tracePath: artifacts.tracePath,
        screenshotPath: artifacts.finalScreenshotPath,
      });
      return timeoutMessage;
    } catch (err: any) {
      const message = err.message || 'Error en browser_web';
      finalStatus = 'error';
      finalMessage = message;
      this.lastVerification = message;
      this.emit('task-failed', {
        message,
        steps: this.currentStep,
        backend: 'browser_web',
        error: message,
        taskId: artifacts.taskId,
        reportPath: artifacts.reportPath,
        tracePath: artifacts.tracePath,
        screenshotPath: artifacts.finalScreenshotPath,
      });
      throw err;
    } finally {
      await this.finalizeTaskArtifacts({
        artifacts,
        task,
        options,
        history,
        startedAt,
        finishedAt: new Date().toISOString(),
        finalStatus,
        finalMessage,
        traceStarted,
        traceStartError,
        finalSnapshot,
      });

      this.status = 'idle';
      this.currentTask = null;
      this.currentStep = 0;
      this.currentMaxSteps = 0;
      this.currentUrl = this.page && !this.page.isClosed() ? this.page.url() : null;
      this.abortController = null;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.status !== 'idle' || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.executeTaskInternal(next.task, next.options)
      .then(next.resolve)
      .catch(next.reject);
  }

  private getProfilesBaseDir(): string {
    return getBrowserWebProfilesBaseDir();
  }

  private sanitizeProfileId(profileId: string): string {
    return sanitizeBrowserProfileId(profileId);
  }

  private resolveProfileId(profileId?: string): string {
    return resolveBrowserProfileId(profileId);
  }

  private getProfileDirectory(profileId: string): string {
    return getBrowserProfileDirectory(profileId);
  }

  private createTaskArtifacts(task: string): BrowserTaskArtifacts {
    return createBrowserTaskArtifacts(task);
  }

  private async startTaskTrace(): Promise<{ success: boolean; error: string | null }> {
    return startBrowserTaskTrace(this.context);
  }

  private async finalizeTaskArtifacts(params: {
    artifacts: BrowserTaskArtifacts;
    task: string;
    options?: BrowserTaskOptions;
    history: BrowserHistoryEntry[];
    startedAt: string;
    finishedAt: string;
    finalStatus: 'completed' | 'failed' | 'cancelled' | 'error';
    finalMessage: string;
    traceStarted: boolean;
    traceStartError: string | null;
    finalSnapshot: BrowserPageSnapshot | null;
  }): Promise<void> {
    const {
      artifacts,
      task,
      options,
      history,
      startedAt,
      finishedAt,
      finalStatus,
      finalMessage,
      traceStarted,
      traceStartError,
    } = params;

    let finalSnapshot = params.finalSnapshot;
    if (!finalSnapshot && this.page && !this.page.isClosed()) {
      finalSnapshot = await this.collectSnapshot(this.page).catch(() => null);
    }

    let traceStopError: string | null = null;
    let tracePath: string | null = null;
    if (traceStarted && this.context?.tracing) {
      try {
        await this.context.tracing.stop({ path: artifacts.tracePath });
        if (fs.existsSync(artifacts.tracePath)) {
          tracePath = artifacts.tracePath;
        }
      } catch (err: any) {
        traceStopError = err.message || 'No se pudo guardar el trace de Playwright.';
      }
    }

    let screenshotPath: string | null = null;
    if (finalSnapshot?.screenshotBase64) {
      try {
        fs.writeFileSync(artifacts.finalScreenshotPath, Buffer.from(finalSnapshot.screenshotBase64, 'base64'));
        screenshotPath = artifacts.finalScreenshotPath;
      } catch {
        screenshotPath = null;
      }
    }

    const report = {
      taskId: artifacts.taskId,
      task,
      options: options || {},
      backend: 'browser_web',
      status: finalStatus,
      message: finalMessage,
      profile: {
        id: this.currentProfileId,
        mode: this.currentProfileMode,
      },
      startedAt,
      finishedAt,
      finalUrl: finalSnapshot?.url || this.currentUrl,
      finalTitle: finalSnapshot?.title || '',
      currentStep: this.currentStep,
      maxSteps: this.currentMaxSteps,
      lastAction: this.lastAction,
      lastVerification: this.lastVerification,
      trace: {
        path: tracePath,
        startError: traceStartError,
        stopError: traceStopError,
      },
      artifacts: {
        runDirectory: artifacts.runDirectory,
        reportPath: artifacts.reportPath,
        finalScreenshotPath: screenshotPath,
      },
      history,
    };

    try {
      fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), 'utf-8');
      this.lastReportPath = artifacts.reportPath;
    } catch {
      this.lastReportPath = null;
    }

    this.lastTracePath = tracePath;
    this.lastScreenshotPath = screenshotPath;
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada.');
    }
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  private async getPlaywright(): Promise<PlaywrightModule> {
    if (!this.playwright) {
      this.playwright = await import('playwright-core');
    }
    return this.playwright;
  }

  private async ensurePage(options?: BrowserTaskOptions): Promise<any> {
    const requestedProfileMode: BrowserProfileMode = options?.isolated ? 'isolated' : 'persistent';
    const requestedProfileId = this.resolveProfileId(options?.profileId);

    const modeChanged = this.currentProfileMode !== requestedProfileMode;
    const profileChanged = requestedProfileMode === 'persistent' && this.currentProfileId !== requestedProfileId;
    if (modeChanged || profileChanged) {
      await this.disposeBrowserResources();
    }

    const existingPage = this.page && !this.page.isClosed() ? this.page : null;
    if (existingPage) {
      this.currentProfileId = requestedProfileMode === 'persistent' ? requestedProfileId : null;
      this.currentProfileMode = requestedProfileMode;
      await existingPage.bringToFront().catch(() => {});
      return existingPage;
    }

    const playwright = await this.getPlaywright();
    if (requestedProfileMode === 'persistent') {
      this.context = await this.launchPersistentContext(playwright, requestedProfileId);
      this.browser = null;
      this.currentProfileId = requestedProfileId;
      this.currentProfileMode = 'persistent';
    } else {
      if (!this.browser) {
        this.browser = await this.launchBrowser(playwright);
      }
      if (!this.context) {
        this.context = await this.browser.newContext({
          viewport: { width: 1440, height: 960 },
          ignoreHTTPSErrors: true,
        });
      }
      this.currentProfileId = null;
      this.currentProfileMode = 'isolated';
    }

    const existingContextPage = this.context?.pages?.().find((candidate: any) => !candidate.isClosed?.());
    this.page = existingContextPage || await this.context.newPage();
    await this.page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.bringToFront().catch(() => {});
    return this.page;
  }

  private async disposeBrowserResources(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
    } finally {
      this.page = null;
    }

    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
    } finally {
      this.context = null;
    }

    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
    } finally {
      this.browser = null;
      this.currentProfileId = null;
      this.currentProfileMode = null;
    }
  }

  private async launchBrowser(playwright: PlaywrightModule): Promise<any> {
    let lastError: Error | null = null;

    for (const candidate of WINDOWS_BROWSER_CANDIDATES) {
      try {
        if ('executablePath' in candidate && candidate.executablePath && !fs.existsSync(candidate.executablePath)) {
          continue;
        }

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

  private async launchPersistentContext(playwright: PlaywrightModule, profileId: string): Promise<any> {
    let lastError: Error | null = null;
    const profilePath = this.getProfileDirectory(profileId);
    fs.mkdirSync(profilePath, { recursive: true });

    for (const candidate of WINDOWS_BROWSER_CANDIDATES) {
      try {
        if ('executablePath' in candidate && candidate.executablePath && !fs.existsSync(candidate.executablePath)) {
          continue;
        }

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

  private shouldNavigateToStartUrl(page: any, startUrl: string): boolean {
    const current = page.url?.() || '';
    return normalizeComparableUrl(current) !== normalizeComparableUrl(startUrl);
  }

  private async collectSnapshot(page: any): Promise<BrowserPageSnapshot> {
    const title = await page.title().catch(() => '');
    const url = page.url();
    const screenshotBuffer = await page.screenshot({ type: 'png', animations: 'disabled' }).catch(() => null);
    const screenshotBase64 = screenshotBuffer ? Buffer.from(screenshotBuffer).toString('base64') : '';

    const domSnapshot = await page.evaluate((input: { maxElements: number; maxTextExcerpt: number }) => {
      const { maxElements, maxTextExcerpt } = input;
      const previous = document.querySelectorAll('[data-soflia-ref]');
      previous.forEach((node) => node.removeAttribute('data-soflia-ref'));

      const isVisible = (el: Element) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 6 || rect.height < 6) return false;
        if (rect.bottom < 0 || rect.right < 0) return false;
        if (rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
        return true;
      };

      const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

      const getText = (el: Element) => clean(el.textContent || '').slice(0, 90);

      const getLabel = (el: Element) => {
        if (!(el instanceof HTMLElement)) return '';
        const aria = el.getAttribute('aria-label') || '';
        if (aria) return clean(aria).slice(0, 90);

        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelText = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent || '')
            .join(' ');
          if (labelText) return clean(labelText).slice(0, 90);
        }

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            const labelText = clean(label?.textContent || '');
            if (labelText) return labelText.slice(0, 90);
          }
        }

        return '';
      };

      const getValue = (el: Element) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          return clean(el.value || '').slice(0, 120);
        }
        if (el instanceof HTMLSelectElement) {
          return clean(el.selectedOptions[0]?.textContent || el.value || '').slice(0, 120);
        }
        if (el instanceof HTMLElement && el.isContentEditable) {
          return clean(el.textContent || '').slice(0, 120);
        }
        return '';
      };

      const seen = new Set<Element>();
      const elements: BrowserElementSnapshot[] = [];
      const selector = [
        'a',
        'button',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[role="textbox"]',
        '[role="combobox"]',
        '[contenteditable="true"]',
        '[data-testid]',
      ].join(',');

      let index = 0;
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        index++;
        const ref = `ref-${index}`;
        el.setAttribute('data-soflia-ref', ref);
        const role = el.getAttribute('role') || '';
        const tag = el.tagName.toLowerCase();
        const placeholder = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? (el.placeholder || '').slice(0, 90)
          : '';
        const type = el instanceof HTMLInputElement ? (el.type || '').slice(0, 60) : '';
        const href = el instanceof HTMLAnchorElement ? (el.href || '').slice(0, 180) : '';
        const disabled = el instanceof HTMLElement && (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true');
        const checked = el instanceof HTMLInputElement ? !!el.checked : false;

        elements.push({
          ref,
          tag,
          role,
          text: getText(el),
          label: getLabel(el),
          placeholder,
          type,
          href,
          value: getValue(el),
          disabled,
          checked,
        });

        if (elements.length >= maxElements) break;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeRef = activeElement?.getAttribute('data-soflia-ref') || '';
      const textExcerpt = clean(document.body?.innerText || '').slice(0, maxTextExcerpt);

      return {
        elements,
        textExcerpt,
        scrollY: Math.round(window.scrollY || 0),
        activeRef,
      };
    }, { maxElements: MAX_VISIBLE_ELEMENTS, maxTextExcerpt: MAX_TEXT_EXCERPT });

    const elements = Array.isArray(domSnapshot?.elements) ? domSnapshot.elements : [];
    const snapshot: BrowserPageSnapshot = {
      url,
      title,
      textExcerpt: domSnapshot?.textExcerpt || '',
      elements,
      screenshotBase64,
      scrollY: typeof domSnapshot?.scrollY === 'number' ? domSnapshot.scrollY : 0,
      activeRef: typeof domSnapshot?.activeRef === 'string' ? domSnapshot.activeRef : '',
      signature: '',
    };

    snapshot.signature = this.buildSnapshotSignature(snapshot);
    return snapshot;
  }

  private buildSnapshotSignature(snapshot: BrowserPageSnapshot): string {
    const compactElements = snapshot.elements.slice(0, 12).map((element) => [
      element.ref,
      element.tag,
      element.role,
      element.label,
      element.text,
      element.placeholder,
      element.type,
      element.value,
      element.checked ? 'checked' : '',
      element.disabled ? 'disabled' : '',
    ].join('|'));

    return [
      normalizeComparableUrl(snapshot.url),
      normalizeText(snapshot.title),
      normalizeText(snapshot.textExcerpt).slice(0, 700),
      String(snapshot.scrollY),
      snapshot.activeRef,
      compactElements.join('||'),
    ].join('##');
  }

  private async decideNextAction(
    task: string,
    snapshot: BrowserPageSnapshot,
    history: BrowserHistoryEntry[],
  ): Promise<BrowserActionPayload> {
    const prompt = buildBrowserActionPrompt(task, snapshot, history);
    const ai = this.getGenAI();

    for (const modelId of [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]) {
      try {
        const model = ai.getGenerativeModel({ model: modelId });
        const parts: any[] = [];

        if (snapshot.screenshotBase64) {
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: snapshot.screenshotBase64,
            },
          });
        }

        parts.push({ text: prompt });
        const result = await model.generateContent(parts);
        return parseBrowserAction(result.response.text());
      } catch (err: any) {
        if (modelId === DEFAULT_FALLBACK_MODEL) {
          throw err;
        }
      }
    }

    throw new Error('No se pudo obtener una accion del modelo para browser_web.');
  }

  private async executeAction(page: any, action: BrowserActionPayload): Promise<void> {
    await executeBrowserAction(page, action);
  }

}
