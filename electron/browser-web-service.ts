import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { app as electronApp } from 'electron';

type PlaywrightModule = typeof import('playwright-core');

type BrowserTaskStatus = 'idle' | 'executing';

interface BrowserTaskOptions {
  maxSteps?: number;
  startUrl?: string;
}

interface BrowserQueueEntry {
  task: string;
  options?: BrowserTaskOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

interface BrowserActionPayload {
  action: 'goto' | 'click_ref' | 'fill_ref' | 'press_key' | 'scroll' | 'wait' | 'done' | 'fail';
  ref?: string;
  url?: string;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  message: string;
  expected?: string;
}

interface BrowserElementSnapshot {
  ref: string;
  tag: string;
  role: string;
  text: string;
  label: string;
  placeholder: string;
  type: string;
  href: string;
  value: string;
  disabled: boolean;
  checked: boolean;
}

interface BrowserPageSnapshot {
  url: string;
  title: string;
  textExcerpt: string;
  elements: BrowserElementSnapshot[];
  screenshotBase64: string;
  scrollY: number;
  activeRef: string;
  signature: string;
}

interface BrowserHistoryEntry {
  step: number;
  action: BrowserActionPayload;
  success: boolean;
  url: string;
  title: string;
  error?: string;
  verification?: string;
}

interface BrowserVerificationResult {
  success: boolean;
  message: string;
}

interface BrowserStatusSnapshot {
  status: BrowserTaskStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentUrl: string | null;
  lastAction: string | null;
  lastVerification: string | null;
  lastTracePath: string | null;
  lastReportPath: string | null;
  lastScreenshotPath: string | null;
  queuedTasks: number;
}

interface BrowserTaskArtifacts {
  taskId: string;
  runDirectory: string;
  tracePath: string;
  reportPath: string;
  finalScreenshotPath: string;
}

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash';
const MAX_VISIBLE_ELEMENTS = 45;
const MAX_TEXT_EXCERPT = 1800;
const MAX_HISTORY_ITEMS = 8;
const WAIT_AFTER_ACTION_MS = 450;

const WINDOWS_BROWSER_CANDIDATES = [
  { channel: 'msedge' as const },
  { channel: 'chrome' as const },
  { executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
];

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
      const page = await this.ensurePage();
      const traceStartResult = await this.startTaskTrace();
      traceStarted = traceStartResult.success;
      traceStartError = traceStartResult.error;

      const startUrl = this.inferStartUrl(task, options?.startUrl);
      if (startUrl && this.shouldNavigateToStartUrl(page, startUrl)) {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await this.waitForSettled(page);
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
          const verification = this.verifyActionOutcome(action, beforeSnapshot, afterSnapshot);
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

  private getArtifactsBaseDir(): string {
    try {
      return path.join(electronApp.getPath('userData'), 'computer-use', 'browser-web');
    } catch {
      return path.join(process.cwd(), 'computer-use-artifacts', 'browser-web');
    }
  }

  private sanitizeTaskLabel(task: string): string {
    const cleaned = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return cleaned || 'task';
  }

  private createTaskArtifacts(task: string): BrowserTaskArtifacts {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const taskId = `browser-${Date.now().toString(36)}`;
    const runDirectory = path.join(
      this.getArtifactsBaseDir(),
      `${stamp}-${this.sanitizeTaskLabel(task)}`,
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

  private async startTaskTrace(): Promise<{ success: boolean; error: string | null }> {
    if (!this.context?.tracing) {
      return { success: false, error: 'Tracing de Playwright no disponible.' };
    }

    try {
      await this.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
      return { success: true, error: null };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'No se pudo iniciar el trace de Playwright.',
      };
    }
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

  private async ensurePage(): Promise<any> {
    if (this.page && !this.page.isClosed()) {
      await this.page.bringToFront().catch(() => {});
      return this.page;
    }

    const playwright = await this.getPlaywright();
    if (!this.browser) {
      this.browser = await this.launchBrowser(playwright);
    }
    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1440, height: 960 },
        ignoreHTTPSErrors: true,
      });
    }

    this.page = await this.context.newPage();
    await this.page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.bringToFront().catch(() => {});
    return this.page;
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

  private inferStartUrl(task: string, explicitUrl?: string): string | null {
    if (explicitUrl) return this.normalizeUrl(explicitUrl);

    const urlMatch = task.match(/https?:\/\/[^\s)]+/i);
    if (urlMatch) {
      return this.normalizeUrl(urlMatch[0]);
    }

    const lower = task.toLowerCase();
    if (lower.includes('gmail')) return 'https://mail.google.com/';
    if (lower.includes('calendar')) return 'https://calendar.google.com/';
    if (lower.includes('google docs') || lower.includes('documento de google')) return 'https://docs.google.com/';
    if (lower.includes('google drive') || lower.includes('drive')) return 'https://drive.google.com/';
    if (lower.includes('linkedin')) return 'https://www.linkedin.com/';
    if (lower.includes('notion')) return 'https://www.notion.so/';
    if (lower.includes('salesforce')) return 'https://www.salesforce.com/';
    if (lower.includes('hubspot')) return 'https://app.hubspot.com/';
    return null;
  }

  private shouldNavigateToStartUrl(page: any, startUrl: string): boolean {
    const current = page.url?.() || '';
    return this.normalizeComparableUrl(current) !== this.normalizeComparableUrl(startUrl);
  }

  private normalizeUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return `https://${url}`;
  }

  private normalizeComparableUrl(url: string): string {
    return (url || '')
      .trim()
      .replace(/#.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
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
      this.normalizeComparableUrl(snapshot.url),
      this.normalizeText(snapshot.title),
      this.normalizeText(snapshot.textExcerpt).slice(0, 700),
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
    const prompt = this.buildPrompt(task, snapshot, history);
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
        return this.parseAction(result.response.text());
      } catch (err: any) {
        if (modelId === DEFAULT_FALLBACK_MODEL) {
          throw err;
        }
      }
    }

    throw new Error('No se pudo obtener una accion del modelo para browser_web.');
  }

  private buildPrompt(task: string, snapshot: BrowserPageSnapshot, history: BrowserHistoryEntry[]): string {
    const historyText = history.slice(-MAX_HISTORY_ITEMS).map((entry) => {
      const status = entry.success ? 'OK' : `ERROR: ${entry.error || 'sin detalle'}`;
      const verification = entry.verification ? ` Verificacion: ${entry.verification}` : '';
      return `Paso ${entry.step}: ${entry.action.action} - ${status} - ${entry.action.message} - URL: ${entry.url}.${verification}`;
    }).join('\n');

    const elementsText = snapshot.elements.length > 0
      ? snapshot.elements.map((element) => {
        const fields = [
          `[${element.ref}]`,
          element.role || element.tag,
          element.label && `label="${element.label}"`,
          element.text && `text="${element.text}"`,
          element.placeholder && `placeholder="${element.placeholder}"`,
          element.type && `type="${element.type}"`,
          element.value && `value="${element.value}"`,
          element.checked ? 'checked=true' : '',
          element.disabled ? 'disabled=true' : '',
          element.href && `href="${element.href}"`,
        ].filter(Boolean);

        return fields.join(' | ');
      }).join('\n')
      : '(sin elementos interactivos visibles)';

    return `TAREA WEB: ${task}

CONTEXTO ACTUAL:
- URL: ${snapshot.url}
- Titulo: ${snapshot.title || '(sin titulo)'}
- Texto visible resumido: ${snapshot.textExcerpt || '(sin texto relevante)'}
- ScrollY: ${snapshot.scrollY}
- Elemento enfocado: ${snapshot.activeRef || '(sin foco relevante)'}

ELEMENTOS INTERACTIVOS VISIBLES:
${elementsText}

HISTORIAL RECIENTE:
${historyText || '(sin historial)'}

REGLAS:
1. Prefiere acciones estructuradas basadas en refs visibles.
2. Usa "goto" solo si necesitas ir a otro sitio o resolver una navegacion bloqueada.
3. Usa "click_ref" para botones, links, tabs, menus y checkboxes.
4. Usa "fill_ref" para inputs, textareas, selects o campos editables.
5. Usa "press_key" solo para Enter, Tab, Escape o atajos concretos.
6. Si la pagina ya muestra el objetivo cumplido, usa "done".
7. Si una accion reciente fallo o no produjo cambio, no la repitas igual. Elige otra estrategia.
8. Nunca inventes refs. Solo puedes usar refs listadas arriba.
9. En "expected" describe un cambio observable: nueva URL, modal abierto, texto visible, valor escrito o foco cambiado.
10. En "message" explica brevemente que ves y que haras.

RESPONDE SOLO JSON valido:
{
  "action": "goto|click_ref|fill_ref|press_key|scroll|wait|done|fail",
  "ref": "ref-1",
  "url": "https://...",
  "text": "texto a escribir",
  "key": "Enter|Tab|Escape|Control+L|Control+K",
  "direction": "up|down",
  "amount": 1,
  "expected": "que deberia cambiar despues de la accion",
  "message": "que veo y que hago"
}`;
  }

  private parseAction(rawText: string): BrowserActionPayload {
    const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error(`No se pudo parsear la respuesta del backend web: ${jsonText.slice(0, 240)}`);
      }
      parsed = JSON.parse(match[0]);
    }

    return {
      action: parsed.action,
      ref: typeof parsed.ref === 'string' ? parsed.ref.trim() : undefined,
      url: typeof parsed.url === 'string' ? parsed.url.trim() : undefined,
      text: typeof parsed.text === 'string' ? parsed.text : undefined,
      key: typeof parsed.key === 'string' ? parsed.key.trim() : undefined,
      direction: parsed.direction === 'up' ? 'up' : 'down',
      amount: typeof parsed.amount === 'number' ? parsed.amount : undefined,
      expected: typeof parsed.expected === 'string' ? parsed.expected.trim() : undefined,
      message: typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : `Accion ${typeof parsed.action === 'string' ? parsed.action : 'desconocida'}`,
    };
  }

  private async executeAction(page: any, action: BrowserActionPayload): Promise<void> {
    switch (action.action) {
      case 'goto':
        if (!action.url) throw new Error('La accion goto requiere url.');
        await page.goto(this.normalizeUrl(action.url), { waitUntil: 'domcontentloaded', timeout: 20000 });
        await this.waitForSettled(page);
        return;

      case 'click_ref': {
        if (!action.ref) throw new Error('La accion click_ref requiere ref.');
        const locator = this.locatorForRef(page, action.ref);
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        await locator.waitFor({ state: 'visible', timeout: 7000 });

        try {
          await locator.click({ timeout: 7000 });
        } catch (clickError: any) {
          const fallbackClicked = await locator.evaluate((node: any) => {
            if (node instanceof HTMLElement) {
              node.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!fallbackClicked) {
            throw clickError;
          }
        }

        await this.waitForSettled(page);
        return;
      }

      case 'fill_ref': {
        if (!action.ref) throw new Error('La accion fill_ref requiere ref.');
        const locator = this.locatorForRef(page, action.ref);
        const text = action.text || '';
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        await locator.waitFor({ state: 'visible', timeout: 7000 });

        const tag = await locator.evaluate((node: any) => {
          return node instanceof HTMLElement ? node.tagName.toLowerCase() : '';
        }).catch(() => '');

        const isContentEditable = await locator.evaluate((node: any) => {
          return node instanceof HTMLElement ? !!node.isContentEditable : false;
        }).catch(() => false);

        if (tag === 'select') {
          const selected = await locator.selectOption({ label: text }).catch(async () => {
            return locator.selectOption({ value: text }).catch(async () => {
              return locator.selectOption(text).catch(() => []);
            });
          });

          if (!Array.isArray(selected) || selected.length === 0) {
            throw new Error(`No se pudo seleccionar "${text}" en el campo ${action.ref}.`);
          }
        } else if (isContentEditable) {
          await locator.click({ timeout: 7000 });
          await page.keyboard.press('Control+A').catch(() => {});
          await page.keyboard.type(text);
        } else {
          try {
            await locator.fill(text, { timeout: 7000 });
          } catch {
            await locator.click({ timeout: 7000 });
            await page.keyboard.press('Control+A').catch(() => {});
            await page.keyboard.type(text);
          }
        }

        await this.waitForSettled(page);
        return;
      }

      case 'press_key':
        if (!action.key) throw new Error('La accion press_key requiere key.');
        await page.keyboard.press(action.key);
        await this.waitForSettled(page);
        return;

      case 'scroll': {
        const amount = Math.max(1, action.amount || 1);
        const delta = (action.direction || 'down') === 'up' ? -800 * amount : 800 * amount;
        await page.mouse.wheel(0, delta);
        await this.waitForSettled(page);
        return;
      }

      case 'wait':
        await page.waitForTimeout(Math.max(500, (action.amount || 1) * 1000));
        return;

      default:
        throw new Error(`Accion no soportada por browser_web: ${action.action}`);
    }
  }

  private verifyActionOutcome(
    action: BrowserActionPayload,
    before: BrowserPageSnapshot,
    after: BrowserPageSnapshot,
  ): BrowserVerificationResult {
    if (action.action === 'wait') {
      return { success: true, message: 'Espera ejecutada.' };
    }

    if (action.expected && this.expectedAppears(action.expected, after)) {
      return { success: true, message: `Cambio esperado detectado: ${action.expected}` };
    }

    if (action.action === 'goto') {
      if (action.url && this.normalizeComparableUrl(after.url).startsWith(this.normalizeComparableUrl(this.normalizeUrl(action.url)))) {
        return { success: true, message: `Navegacion confirmada a ${after.url}.` };
      }
      return {
        success: false,
        message: `La navegacion no llego al destino esperado. URL actual: ${after.url || '(sin URL)'}.`,
      };
    }

    if (action.action === 'fill_ref') {
      const afterElement = this.findElement(after, action.ref);
      const typedText = this.normalizeText(action.text || '');
      if (afterElement && typedText) {
        const targetValue = this.normalizeText(afterElement.value || afterElement.text);
        if (targetValue.includes(typedText)) {
          return { success: true, message: `El campo ${action.ref} refleja el texto escrito.` };
        }
      }
      if (before.signature !== after.signature) {
        return { success: true, message: 'El DOM cambio despues del llenado.' };
      }
      return {
        success: false,
        message: `No se detecto cambio verificable despues de llenar ${action.ref}.`,
      };
    }

    if (action.action === 'scroll') {
      if (before.scrollY !== after.scrollY || before.signature !== after.signature) {
        return { success: true, message: `Scroll detectado. Posicion actual ${after.scrollY}.` };
      }
      return { success: false, message: 'No se detecto desplazamiento visible despues del scroll.' };
    }

    if (action.action === 'press_key') {
      const key = this.normalizeText(action.key || '');
      if ((key === 'tab' || key === 'shift+tab') && before.activeRef !== after.activeRef) {
        return { success: true, message: `El foco cambio de ${before.activeRef || 'ninguno'} a ${after.activeRef || 'ninguno'}.` };
      }
      if (before.signature !== after.signature || before.url !== after.url) {
        return { success: true, message: `La tecla ${action.key} produjo un cambio visible.` };
      }
      return { success: false, message: `La tecla ${action.key} no produjo un cambio verificable.` };
    }

    if (action.action === 'click_ref') {
      const afterElement = this.findElement(after, action.ref);
      if (before.url !== after.url || before.title !== after.title) {
        return { success: true, message: `El click cambio la pagina a ${after.url}.` };
      }
      if (before.activeRef !== after.activeRef && after.activeRef) {
        return { success: true, message: `El click movio el foco a ${after.activeRef}.` };
      }
      if (!afterElement) {
        return { success: true, message: `El elemento ${action.ref} ya no esta visible despues del click.` };
      }
      if (before.signature !== after.signature) {
        return { success: true, message: 'El DOM cambio despues del click.' };
      }
      return { success: false, message: `No se detecto cambio visible despues de hacer click en ${action.ref}.` };
    }

    return { success: true, message: 'Accion ejecutada.' };
  }

  private expectedAppears(expected: string, snapshot: BrowserPageSnapshot): boolean {
    const needle = this.normalizeText(expected);
    if (!needle || needle.length < 3) {
      return false;
    }

    const haystack = this.normalizeText([
      snapshot.url,
      snapshot.title,
      snapshot.textExcerpt,
      snapshot.activeRef,
      snapshot.elements.map((element) => [
        element.ref,
        element.tag,
        element.role,
        element.label,
        element.text,
        element.placeholder,
        element.type,
        element.value,
        element.href,
        element.checked ? 'checked' : '',
      ].join(' ')).join(' '),
    ].join(' '));

    return haystack.includes(needle);
  }

  private findElement(snapshot: BrowserPageSnapshot, ref?: string): BrowserElementSnapshot | undefined {
    if (!ref) {
      return undefined;
    }
    return snapshot.elements.find((element) => element.ref === ref);
  }

  private normalizeText(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private locatorForRef(page: any, ref: string): any {
    return page.locator(`[data-soflia-ref="${ref}"]`).first();
  }

  private async waitForSettled(page: any): Promise<void> {
    await page.waitForLoadState('domcontentloaded', { timeout: 7000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(WAIT_AFTER_ACTION_MS);
  }
}
