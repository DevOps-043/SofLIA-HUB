import { EventEmitter } from 'node:events';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrowserWebService } from './browser-web-service';
import { WindowsUIAService } from './windows-uia-service';
import { registerBackendEventForwarding } from './desktop-agent/backend-event-forwarding';
import { getFocusedCaptureBounds as resolveFocusedCaptureBounds } from './desktop-agent/focused-capture-bounds';
import { buildHistoryContext } from './desktop-agent/history-context';
import { DesktopKeyboardControls } from './desktop-agent/keyboard-controls';
import { DesktopMouseControls } from './desktop-agent/mouse-controls';
import { resolveLegacyDesktopStatus } from './desktop-agent/legacy-status';
import { parseVisionResponse } from './desktop-agent/parsers';
import { executeParallelDesktopTasks } from './desktop-agent/parallel-task-runner';
import { createDesktopTaskPlan } from './desktop-agent/plan-runtime';
import { startContinuousObservation } from './desktop-agent/observation-runtime';
import { runDesktopActionWithRetry } from './desktop-agent/desktop-action-runner';
import { summarizeDesktopHistory } from './desktop-agent/history-summary-runtime';
import { checkStrategicPhaseCompletion } from './desktop-agent/phase-runtime';
import { executeProactiveRecovery } from './desktop-agent/recovery-runtime';
import { applySmartActionDelay } from './desktop-agent/action-delay';
import { getErrorMessage } from './desktop-agent/error-utils';
import {
  assertActionTargetsVisibleContent as assertVisibleActionTargets,
  formatActionCoordinateResolution,
} from './desktop-agent/action-coordinate-resolution';
import { refineDesktopActionCoordinates } from './desktop-agent/action-coordinate-refinement';
import { executeDesktopAction } from './desktop-agent/action-executor';
import {
  executeBrowserBackendTask,
  executeWindowsUIABackendTask,
  runDesktopFallbackFromUIA as runUIAFallback,
  shouldUseBrowserBackend,
  shouldUseWindowsUIABackend,
} from './desktop-agent/routing';
import { captureCompositeScreenshot as captureDesktopScreenshot } from './desktop-agent/screenshot-capture';
import {
  dipToScreenPoint as convertDipToScreenPoint,
  mapDesktopPointToScreenshotPoint as mapDesktopPointToScreenshot,
  mapDesktopRectToScreenshotRect as mapDesktopRectToScreenshot,
  mapDipPointToScreenshotPoint as mapDipToScreenshot,
  mapScreenshotToDipPoint as mapScreenshotToDip,
} from './desktop-agent/screenshot-coordinates';
import { buildScreenshotLayout, getVirtualDesktopBounds } from './desktop-agent/screenshot-layout';
import {
  describeScreenshotMonitorContext,
  getDisplayRegionLabelFromScreenshotPoint,
} from './desktop-agent/screenshot-monitor-context';
import { applyGridOverlay, applySoMOverlay } from './desktop-agent/screenshot-overlays';
import { loadSharp, type SharpFactory } from './desktop-agent/sharp';
import { createZoomScreenshot } from './desktop-agent/screenshot-zoom';
import { buildDesktopAgentStatus } from './desktop-agent/status-snapshot';
import {
  applyPlanSubGoalProgress,
  buildMaxStepsResult,
  updateRecoveryScreenHash,
} from './desktop-agent/task-loop-helpers';
import {
  abortDesktopAgentTask,
  getDesktopTaskResult,
  processDesktopTaskQueue,
  type DesktopTaskQueueItem,
} from './desktop-agent/task-control';
import { buildVisionPrompt } from './desktop-agent/vision-prompt';
import { quickScreenshotHash, waitForScreenHashChange, waitForWindowTitle } from './desktop-agent/waiting-runtime';
import type {
  DesktopTaskExecutionOptions,
  ScreenshotLayout,
  ScreenshotVirtualBounds,
  WindowsUIAFallbackRunResult,
} from './desktop-agent/types';
import { getForegroundUIElements } from './desktop-agent/ui-elements';
import { DesktopWindowControls } from './desktop-agent/window-controls';
import { createDesktopAgentTask, finishDesktopAgentTask } from './desktop-agent/task-lifecycle';
import {
  type DesktopAgentConfig, type DesktopActionPayload, type ActionHistoryEntry,
  type TaskPlan, type StrategicPlan, type UIElement,
  type HistorySummary, type AgentStatus, type AgentTask, type RecoveryContext,
  type DesktopAgentStatus,
  loadConfig, saveConfig,
} from './desktop-agent-types';

// Re-export types for consumers
export type { DesktopAgentConfig, DesktopActionPayload, UIElement, AgentStatus, AgentTask, DesktopAgentStatus };

const execAsync = promisify(execCb);

const sharpModule: SharpFactory | null = loadSharp();

type VisionContentPart =
  | { inlineData: { mimeType: 'image/png'; data: string } }
  | { text: string };

export class DesktopAgentService extends EventEmitter {
  private config: DesktopAgentConfig;
  private status: AgentStatus = 'idle';
  private currentTask: string | null = null;
  private actionHistory: ActionHistoryEntry[] = [];
  private currentPlan: TaskPlan | null = null;
  private currentStep = 0;
  private abortController: AbortController | null = null;
  private observationInterval: ReturnType<typeof setInterval> | null = null;
  private observationRunning = false;
  private screenScale: { scaleX: number; scaleY: number } = { scaleX: 1.5, scaleY: 1.5 };
  private apiKey: string = '';
  private genAI: GoogleGenerativeAI | null = null;
  private recovery: RecoveryContext = { consecutiveFailures: 0, sameScreenCount: 0, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 };

  private strategicPlan: StrategicPlan | null = null;
  private historySummaries: HistorySummary[] = [];
  private lastZoomImage: string | null = null;
  private currentUIElements: UIElement[] = [];
  private captureMode: 'som' | 'grid' = 'grid';
  private lastActualScreenshotWidth = 0;
  private lastActualScreenshotHeight = 0;
  private lastScreenshotLayout: ScreenshotLayout | null = null;

  private activeTasks: Map<string, AgentTask> = new Map();
  private taskIdCounter = 0;
  private taskQueue: DesktopTaskQueueItem[] = [];
  private browserWeb = new BrowserWebService();
  private windowsUIA = new WindowsUIAService(this);
  private mouseControls = new DesktopMouseControls(
    (script) => this.ps(script),
    (x, y) => this.scale(x, y),
    (ms) => this.delay(ms),
  );
  private keyboardControls = new DesktopKeyboardControls(
    (script) => this.ps(script),
    (ms) => this.delay(ms),
  );
  private windowControls = new DesktopWindowControls((script) => this.ps(script));

  constructor() {
    super();
    this.config = loadConfig();
    this.registerExternalBackendEventForwarding(this.browserWeb);
    this.registerExternalBackendEventForwarding(this.windowsUIA);
  }

  private generateTaskId(): string { return `agent-${++this.taskIdCounter}-${Date.now().toString(36)}`; }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
    this.browserWeb.setApiKey(key);
    this.windowsUIA.setApiKey(key);
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.apiKey) throw new Error('Gemini API key no configurada para DesktopAgent');
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.apiKey);
    return this.genAI;
  }

  getConfig(): DesktopAgentConfig { return { ...this.config }; }

  setConfig(updates: Partial<DesktopAgentConfig>): void {
    this.config = { ...this.config, ...updates };
    saveConfig(this.config);
    this.emit('config-updated', this.config);
  }

  getStatus(): DesktopAgentStatus {
    return buildDesktopAgentStatus({
      activeTasks: this.activeTasks.values(),
      browserStatus: this.browserWeb.getStatus(),
      windowsUIAStatus: this.windowsUIA.getStatus(),
      actionHistory: this.actionHistory,
      status: this.status,
      currentTask: this.currentTask,
      currentStep: this.currentStep,
      currentPlan: this.currentPlan,
      config: this.getConfig(),
    });
  }

  abort(taskId?: string): void {
    abortDesktopAgentTask({
      taskId,
      activeTasks: this.activeTasks,
      abortController: this.abortController,
      abortBrowserTasks: () => this.browserWeb.abortAll(),
      abortWindowsUIATasks: () => this.windowsUIA.abortAll(),
      stopObservation: () => this.stopObservation(),
      processQueue: () => this.processQueue(),
      emit: (eventName: string, payload?: unknown) => { this.emit(eventName, payload); },
    });
  }

  abortAll(): void { this.abort(); }

  isRunning(): boolean { return this.status !== 'idle' || this.activeTasks.size > 0 || this.browserWeb.isRunning() || this.windowsUIA.isRunning(); }

  getActiveTaskCount(): number { return this.activeTasks.size + (this.browserWeb.isRunning() ? 1 : 0) + (this.windowsUIA.isRunning() ? 1 : 0); }

  listBrowserProfiles() { return this.browserWeb.listProfiles(); }

  async resetBrowserProfile(profileId: string) { return this.browserWeb.resetProfile(profileId); }

  async takeScreenshot(fullRes = false): Promise<string> {
    const captureTarget = fullRes
      ? { width: 1920, height: 1080 }
      : { width: this.config.screenshotWidth, height: this.config.screenshotHeight };
    const captured = await this.captureCompositeScreenshot(captureTarget.width, captureTarget.height);

    if (!fullRes) {
      this.updateScreenScale(captured.actualWidth, captured.actualHeight);
    }

    if (!this.config.gridEnabled || fullRes) {
      return captured.base64;
    }

    try {
      return await this.applyGridOverlay(captured.base64, captured.actualWidth, captured.actualHeight);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[DesktopAgent] Grid overlay fallo, usando raw:', message);
      return captured.base64;
    }
  }

  async takeScreenshotWithMarks(): Promise<{ screenshot: string; elements: UIElement[]; mode: 'som' | 'grid' }> {
    const rawScreenshot = await this.takeScreenshotRaw();
    const width = this.config.screenshotWidth;
    const height = this.config.screenshotHeight;

    if (this.config.somEnabled) {
      try {
        const elements = await this.getUIElements();
        if (elements.length >= 3) {
          const marked = await this.applySoMOverlay(rawScreenshot, width, height, elements);
          this.currentUIElements = elements;
          this.captureMode = 'som';
          return { screenshot: marked, elements, mode: 'som' };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[DesktopAgent] SoM overlay fallo, fallback a grid:', message);
      }
    }

    this.currentUIElements = [];
    this.captureMode = 'grid';
    const screenshot = this.config.gridEnabled
      ? await this.applyGridOverlay(rawScreenshot, width, height).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[DesktopAgent] Grid fallback fallo:', message);
        return rawScreenshot;
      })
      : rawScreenshot;
    return { screenshot, elements: [], mode: 'grid' };
  }

  private async takeScreenshotRaw(): Promise<string> {
    const composite = await this.captureCompositeScreenshot(
      this.config.screenshotWidth,
      this.config.screenshotHeight,
    );
    this.updateScreenScale(composite.actualWidth, composite.actualHeight);
    return composite.base64;
  }

  private async applyGridOverlay(base64: string, width: number, height: number): Promise<string> { return applyGridOverlay(sharpModule, base64, width, height, this.config.gridStep); }
  private async applySoMOverlay(base64: string, width: number, height: number, elements: UIElement[]): Promise<string> {
    return applySoMOverlay({ sharp: sharpModule, base64, fallbackWidth: width, fallbackHeight: height, elements, mapRect: (rect) => this.mapDesktopRectToScreenshotRect(rect) });
  }

  async takeZoomScreenshot(centerX: number, centerY: number, radius = 150): Promise<string> {
    return createZoomScreenshot({
      sharpModule,
      centerX,
      centerY,
      radius,
      screenshotWidth: this.config.screenshotWidth,
      zoomResolution: this.config.zoomResolution,
      captureCompositeScreenshot: (width, height) => this.captureCompositeScreenshot(width, height),
      mapScreenshotToDipPoint: (x, y) => this.mapScreenshotToDipPoint(x, y),
      mapDipPointToScreenshotPoint: (x, y, layout) => this.mapDipPointToScreenshotPoint(x, y, layout),
      takeScreenshotRaw: () => this.takeScreenshotRaw(),
    });
  }

  private getVirtualDesktopBounds(): ScreenshotVirtualBounds {
    return getVirtualDesktopBounds();
  }

  private async getFocusedCaptureBounds(): Promise<ScreenshotVirtualBounds | null> { return resolveFocusedCaptureBounds(this.config, (script, timeout) => this.psEncoded(script, timeout)); }

  private buildScreenshotLayout(
    targetWidth: number,
    targetHeight: number,
    captureBounds?: ScreenshotVirtualBounds | null,
  ): ScreenshotLayout {
    return buildScreenshotLayout({ targetWidth, targetHeight, captureBounds });
  }

  private async captureCompositeScreenshot(targetWidth: number, targetHeight: number): Promise<{
    base64: string;
    layout: ScreenshotLayout;
    actualWidth: number;
    actualHeight: number;
  }> {
    const captured = await captureDesktopScreenshot({
      targetWidth,
      targetHeight,
      sharpModule,
      getFocusedCaptureBounds: () => this.getFocusedCaptureBounds(),
    });
    this.lastScreenshotLayout = captured.layout;
    this.lastActualScreenshotWidth = captured.actualWidth;
    this.lastActualScreenshotHeight = captured.actualHeight;
    return captured;
  }

  private dipToScreenPoint(point: { x: number; y: number }): { x: number; y: number } { return convertDipToScreenPoint(point); }

  private mapScreenshotToDipPoint(
    x: number,
    y: number,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): { x: number; y: number } | null {
    return mapScreenshotToDip(x, y, layout);
  }

  public mapDipPointToScreenshotPoint(
    x: number,
    y: number,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): { x: number; y: number } | null {
    return mapDipToScreenshot(x, y, layout);
  }

  public mapDesktopPointToScreenshotPoint(x: number, y: number): { x: number; y: number } | null { return mapDesktopPointToScreenshot(x, y, this.lastScreenshotLayout); }

  public mapDesktopRectToScreenshotRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } | null {
    return mapDesktopRectToScreenshot(rect, this.lastScreenshotLayout);
  }
  async getUIElements(): Promise<UIElement[]> { return getForegroundUIElements(); }

  private calculateScreenScale(): void {
    try {
      const virtualBounds = this.getVirtualDesktopBounds();
      this.lastScreenshotLayout = this.buildScreenshotLayout(this.config.screenshotWidth, this.config.screenshotHeight);
      this.screenScale = {
        scaleX: virtualBounds.width / this.config.screenshotWidth,
        scaleY: virtualBounds.height / this.config.screenshotHeight,
      };
      console.log(
        `[DesktopAgent] Escala inicial: virtual ${virtualBounds.width}x${virtualBounds.height}, render ${this.lastScreenshotLayout.renderScale.toFixed(4)}, offset ${this.lastScreenshotLayout.offsetX},${this.lastScreenshotLayout.offsetY}`,
      );
    } catch {
      this.screenScale = { scaleX: 1920 / this.config.screenshotWidth, scaleY: 1080 / this.config.screenshotHeight };
    }
  }

  private updateScreenScale(actualWidth: number, actualHeight: number): void {
    this.lastActualScreenshotWidth = actualWidth;
    this.lastActualScreenshotHeight = actualHeight;
    try {
      const layout = this.lastScreenshotLayout ?? this.buildScreenshotLayout(actualWidth, actualHeight);
      this.lastScreenshotLayout = layout;
      const virtualBounds = layout.virtualBounds;
      const newScaleX = virtualBounds.width / actualWidth;
      const newScaleY = virtualBounds.height / actualHeight;

      if (Math.abs(newScaleX - this.screenScale.scaleX) > 0.01 || Math.abs(newScaleY - this.screenScale.scaleY) > 0.01) {
        console.log(
          `[DesktopAgent] Escala corregida: screenshot ${actualWidth}x${actualHeight} -> virtual ${virtualBounds.width}x${virtualBounds.height}, scale ${newScaleX.toFixed(2)}x${newScaleY.toFixed(2)}, render ${layout.renderScale.toFixed(4)}, offset ${layout.offsetX},${layout.offsetY}`,
        );
      }
      this.screenScale = { scaleX: newScaleX, scaleY: newScaleY };
    } catch {
      // Keep existing scale
    }
  }

  private getDisplayRegionLabelFromScreenshotPoint(
    x: number,
    y: number,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): string | null {
    return getDisplayRegionLabelFromScreenshotPoint(layout, x, y);
  }

  private describeScreenshotMonitorContext(layout: ScreenshotLayout | null = this.lastScreenshotLayout): string {
    return describeScreenshotMonitorContext(layout, this.getVirtualDesktopBounds());
  }

  private resolveScreenPoint(x: number, y: number): {
    x: number;
    y: number;
    dipX?: number;
    dipY?: number;
    source: 'layout' | 'scale';
    regionLabel?: string | null;
  } {
    const dipPoint = this.mapScreenshotToDipPoint(x, y);
    if (dipPoint) {
      const screenPoint = this.dipToScreenPoint(dipPoint);
      return {
        x: screenPoint.x,
        y: screenPoint.y,
        dipX: dipPoint.x,
        dipY: dipPoint.y,
        source: 'layout',
        regionLabel: this.getDisplayRegionLabelFromScreenshotPoint(x, y),
      };
    }

    return {
      x: Math.round(x * this.screenScale.scaleX),
      y: Math.round(y * this.screenScale.scaleY),
      source: 'scale',
    };
  }

  private refineActionCoordinates(action: DesktopActionPayload): DesktopActionPayload {
    return refineDesktopActionCoordinates({
      action,
      layout: this.lastScreenshotLayout,
      currentUIElements: this.currentUIElements,
      mapDesktopRectToScreenshotRect: (rect: UIElement['boundingRect']) => this.mapDesktopRectToScreenshotRect(rect),
      log: (message: string) => { console.log(message); },
    });
  }

  private scale(x: number, y: number): { x: number; y: number } {
    const resolved = this.resolveScreenPoint(x, y);
    return { x: resolved.x, y: resolved.y };
  }

  private logActionCoordinateResolution(action: DesktopActionPayload): void {
    const message = formatActionCoordinateResolution(action, (x, y) => this.resolveScreenPoint(x, y));
    if (message) console.log(message);
  }

  private assertActionTargetsVisibleContent(action: DesktopActionPayload): void {
    assertVisibleActionTargets(action, (x, y) => this.resolveScreenPoint(x, y));
  }

  private async ps(script: string): Promise<string> {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`,
      { timeout: 10000, windowsHide: true },
    );
    return stdout?.trim() || '';
  }

  private async psEncoded(script: string, timeout = 10000): Promise<string> {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { stdout } = await execAsync(
      `powershell -NoProfile -EncodedCommand ${encoded}`,
      { timeout, windowsHide: true },
    );
    return stdout?.trim() || '';
  }

  async mouseClick(x: number, y: number): Promise<void> { return this.mouseControls.mouseClick(x, y); }
  async mouseDoubleClick(x: number, y: number): Promise<void> { return this.mouseControls.mouseDoubleClick(x, y); }
  async mouseRightClick(x: number, y: number): Promise<void> { return this.mouseControls.mouseRightClick(x, y); }
  async mouseDrag(x1: number, y1: number, x2: number, y2: number, durationMs = 500): Promise<void> { return this.mouseControls.mouseDrag(x1, y1, x2, y2, durationMs); }
  async mouseDown(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> { return this.mouseControls.mouseDown(x, y, button); }
  async mouseUp(x?: number, y?: number): Promise<void> { return this.mouseControls.mouseUp(x, y); }
  async mouseMove(x: number, y: number): Promise<void> { return this.mouseControls.mouseMove(x, y); }
  async mouseScroll(direction: 'up' | 'down', amount = 3): Promise<void> { return this.mouseControls.mouseScroll(direction, amount); }

  async keyboardType(text: string): Promise<void> { return this.keyboardControls.keyboardType(text); }
  async keyboardKey(key: string): Promise<void> { return this.keyboardControls.keyboardKey(key); }
  async keyboardHotkey(...keys: string[]): Promise<void> { return this.keyboardControls.keyboardHotkey(...keys); }

  async focusWindow(titleSubstring: string): Promise<boolean> { return this.windowControls.focusWindow(titleSubstring); }
  async minimizeWindow(titleSubstring: string): Promise<boolean> { return this.windowControls.minimizeWindow(titleSubstring); }
  async maximizeWindow(titleSubstring: string): Promise<boolean> { return this.windowControls.maximizeWindow(titleSubstring); }
  async restoreWindow(titleSubstring: string): Promise<boolean> { return this.windowControls.restoreWindow(titleSubstring); }
  async closeWindow(titleSubstring: string): Promise<boolean> { return this.windowControls.closeWindow(titleSubstring); }
  async listWindows(): Promise<Array<{ title: string; process: string; pid: number }>> { return this.windowControls.listWindows(); }
  async getActiveWindow(): Promise<{ title: string; process: string } | null> { return this.windowControls.getActiveWindow(); }

  async waitForScreenChange(timeoutMs?: number): Promise<boolean> {
    return waitForScreenHashChange({
      timeoutMs: timeoutMs ?? this.config.waitForChangeTimeout,
      intervalMs: this.config.waitForChangeInterval,
      takeScreenshot: () => this.takeScreenshot(),
      delay: (ms) => this.delay(ms),
    });
  }

  async waitForWindow(titleSubstring: string, timeoutMs = 10000): Promise<boolean> {
    return waitForWindowTitle({
      titleSubstring,
      timeoutMs,
      listWindows: () => this.listWindows(),
      delay: (ms) => this.delay(ms),
    });
  }

  private quickHash(base64: string): string { return quickScreenshotHash(base64); }

  private processQueue(): void {
    processDesktopTaskQueue({
      queue: this.taskQueue,
      activeTasks: this.activeTasks,
      maxConcurrentAgents: this.config.maxConcurrentAgents,
      executeTask: (task, options) => this.executeTaskInternal(task, options),
    });
  }

  async executeParallelTasks(tasks: Array<{
    task: string;
    maxSteps?: number;
    backend?: 'auto' | 'browser' | 'desktop' | 'uia';
    startUrl?: string;
    browserProfile?: string;
    browserIsolated?: boolean;
    resetBrowserProfile?: boolean;
  }>): Promise<Array<{ task: string; result: string; success: boolean }>> {
    if (!this.apiKey) throw new Error('API key de Gemini no configurada.');
    return executeParallelDesktopTasks(tasks, (task, options) => this.executeTask(task, options));
  }

  getActiveTasks(): AgentTask[] { return Array.from(this.activeTasks.values()); }
  getTaskResult(taskId: string): { status: AgentStatus; result?: string; error?: string } | null { return getDesktopTaskResult(this.activeTasks, taskId); }

  private restoreLegacyStatusAfterExternalBackendEvent(): void {
    const nextStatus = resolveLegacyDesktopStatus({
      browserStatus: this.browserWeb.getStatus(),
      windowsUIAStatus: this.windowsUIA.getStatus(),
      activeTasks: this.activeTasks.values(),
      observationRunning: this.observationRunning,
    });
    this.status = nextStatus.status;
    this.currentTask = nextStatus.currentTask;
    this.currentStep = nextStatus.currentStep;
  }

  private registerExternalBackendEventForwarding(source: EventEmitter): void {
    registerBackendEventForwarding({
      source,
      emit: (eventName, payload) => { this.emit(eventName, payload); },
      markTaskStarted: (payload) => {
        this.status = 'executing';
        this.currentTask = payload.task || this.currentTask;
        this.currentStep = 0;
      },
      markStep: (payload) => {
        this.currentStep = payload.step || this.currentStep;
      },
      restoreLegacyStatus: () => this.restoreLegacyStatusAfterExternalBackendEvent(),
    });
  }

  async executeTask(task: string, options?: DesktopTaskExecutionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada.');
    }
    if (shouldUseBrowserBackend(task, options)) {
      return executeBrowserBackendTask(this.browserWeb, task, options);
    }
    if (shouldUseWindowsUIABackend(task, options)) {
      return executeWindowsUIABackendTask({
        windowsUIA: this.windowsUIA,
        task,
        options,
        runFallback: (runResult: WindowsUIAFallbackRunResult) => this.runDesktopFallbackFromUIA(task, options, runResult),
      });
    }

    if (this.activeTasks.size >= this.config.maxConcurrentAgents) {
      console.log(`[DesktopAgent] Cola: ${this.activeTasks.size}/${this.config.maxConcurrentAgents} agentes activos. Encolando: "${task}"`);
      return new Promise<string>((resolve, reject) => {
        this.taskQueue.push({ task, options, resolve, reject });
        this.emit('task-queued', { task, queuePosition: this.taskQueue.length });
      });
    }

    return this.executeTaskInternal(task, options);
  }

  private async executeTaskInternal(task: string, options?: DesktopTaskExecutionOptions): Promise<string> {
    const taskId = this.generateTaskId();
    const maxSteps = options?.maxSteps ?? this.config.maxSteps;
    const taskAbort = new AbortController();

    const agentTask = createDesktopAgentTask({
      taskId,
      task,
      maxSteps,
      abortController: taskAbort,
    });
    this.activeTasks.set(taskId, agentTask);

    this.abortController = taskAbort;
    this.status = 'executing';
    this.currentTask = task;
    this.actionHistory = agentTask.actionHistory;
    this.currentStep = 0;
    this.currentPlan = null;
    this.recovery = agentTask.recovery;
    this.strategicPlan = null;
    this.historySummaries = [];
    this.lastZoomImage = null;
    this.currentUIElements = [];
    this.captureMode = 'grid';
    this.calculateScreenScale();

    this.emit('task-started', { task, maxSteps, taskId });
    console.log(`[DesktopAgent] Iniciando tarea [${taskId}]: "${task}" (max ${maxSteps} pasos)`);

    try {
      if (this.config.planningEnabled) {
        this.status = 'planning';
        const screenshot = await this.takeScreenshot();
        this.currentPlan = await this.createPlan(task, screenshot);
        this.emit('plan-created', this.currentPlan);
        console.log(`[DesktopAgent] Plan: ${this.currentPlan.subGoals.length} sub-objetivos, ~${this.currentPlan.estimatedSteps} pasos`);
      }

      this.status = 'executing';

      for (this.currentStep = 0; this.currentStep < maxSteps; this.currentStep++) {
        agentTask.currentStep = this.currentStep;
        if (taskAbort.signal.aborted) {
          return 'Tarea cancelada por el usuario.';
        }

        if (this.currentStep > 0 && this.currentStep % this.config.summarizeEveryNSteps === 0) {
          await this.summarizeHistory();
        }

        if (this.strategicPlan && this.currentStep > 0 && this.currentStep % 10 === 0) {
          await this.checkPhaseCompletion(task);
        }

        const { screenshot } = await this.takeScreenshotWithMarks();
        const currentHash = this.quickHash(screenshot);

        updateRecoveryScreenHash(this.recovery, currentHash);
        if (this.recovery.sameScreenCount >= this.config.stuckDetectionThreshold) {
          console.warn(`[DesktopAgent] ?? ATASCADO — pantalla sin cambios durante ${this.recovery.sameScreenCount} pasos`);
          this.emit('stuck-detected', { step: this.currentStep, sameScreenCount: this.recovery.sameScreenCount });

          if (this.config.replanOnStuck) {
            const recovered = await this.proactiveRecovery(task, screenshot, 'stuck');
            if (recovered) {
              this.recovery.sameScreenCount = 0;
              continue; // Re-enter loop with fresh screenshot
            }
          }
        }

        let actionPayload: DesktopActionPayload;
        const useRecoveryContext = this.recovery.consecutiveFailures > 0;

        try {
          actionPayload = await this.visionStep(task, screenshot, false, useRecoveryContext);
        } catch (err: unknown) {
          console.error(`[DesktopAgent] Error de visión (paso ${this.currentStep + 1}):`, getErrorMessage(err));
          try {
            await this.delay(2000);
            actionPayload = await this.visionStep(task, screenshot, true, useRecoveryContext);
          } catch {
            this.recovery.consecutiveFailures++;
            if (this.recovery.consecutiveFailures >= this.config.maxConsecutiveFailures * 2) {
              return `Error persistente al analizar la pantalla después de ${this.currentStep} pasos.`;
            }
            continue;
          }
        }

        this.emit('step', { step: this.currentStep + 1, maxSteps, action: actionPayload });
        console.log(`[DesktopAgent] Paso ${this.currentStep + 1}: ${actionPayload.action} — ${actionPayload.message}`);

        if (actionPayload.action === 'done') {
          const msg = actionPayload.message || 'Tarea completada.';
          agentTask.result = msg;
          this.emit('task-completed', { message: msg, steps: this.currentStep + 1, recoveries: this.recovery.totalRecoveries, taskId });
          return msg;
        }

        if (actionPayload.action === 'fail') {
          console.warn(`[DesktopAgent] [${taskId}] LLM reportó fallo: ${actionPayload.message}`);
          if (this.recovery.totalRecoveries > 0 && this.currentStep - this.recovery.lastRecoveryStep < 3) {
            const msg = `Error después de recuperación: ${actionPayload.message}`;
            agentTask.error = msg;
            this.emit('task-failed', { message: msg, steps: this.currentStep + 1, taskId });
            return msg;
          }
          // Try proactive recovery before giving up
          const recovered = await this.proactiveRecovery(task, screenshot, 'fail', actionPayload.message);
          if (recovered) continue;
          const msg = `Error: ${actionPayload.message}`;
          agentTask.error = msg;
          this.emit('task-failed', { message: msg, steps: this.currentStep + 1, taskId });
          return msg;
        }

        const actionRun = await runDesktopActionWithRetry({
          action: actionPayload,
          currentStep: this.currentStep,
          currentHash,
          config: this.config,
          recovery: this.recovery,
          refineAction: (action) => this.refineActionCoordinates(action),
          executeAction: (action) => this.executeAction(action),
          delay: (ms) => this.delay(ms),
          takeScreenshotRaw: () => this.takeScreenshotRaw(),
          quickHash: (base64) => this.quickHash(base64),
          getErrorMessage,
        });
        actionPayload = actionRun.action;
        const { entry, actionSuccess } = actionRun;

        this.actionHistory.push(entry);

        if (!actionSuccess || entry.verificationFailed) {
          this.recovery.consecutiveFailures++;
          if (this.recovery.consecutiveFailures >= this.config.maxConsecutiveFailures) {
            console.warn(`[DesktopAgent] ?? ${this.recovery.consecutiveFailures} fallos consecutivos — activando recuperación proactiva`);
            this.emit('consecutive-failures', { count: this.recovery.consecutiveFailures, step: this.currentStep });
            const recovered = await this.proactiveRecovery(task, await this.takeScreenshot(), 'failures');
            if (recovered) {
              this.recovery.consecutiveFailures = 0;
              continue;
            }
          }
        } else {
          this.recovery.consecutiveFailures = 0; // Reset on success
        }

        applyPlanSubGoalProgress(this.currentPlan, actionPayload);

        await this.smartDelay(actionPayload);
      }

      const lastMsg = this.actionHistory[this.actionHistory.length - 1]?.action.message || '';
      const resultMsg = buildMaxStepsResult(maxSteps, lastMsg);
      agentTask.result = resultMsg;
      return resultMsg;

    } catch (err: unknown) {
      const message = getErrorMessage(err);
      const stackPreview = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined;
      const errorMsg = `Error en paso ${this.currentStep}: ${message}`;
      console.error(`[DesktopAgent] ? FATAL [${taskId}]:`, message, stackPreview);
      agentTask.error = errorMsg;
      this.emit('task-failed', { message: errorMsg, steps: this.currentStep, taskId, error: message });
      throw err;
    } finally {
      const legacyState = finishDesktopAgentTask({
        agentTask,
        activeTasks: this.activeTasks,
        taskId,
      });
      this.status = legacyState.status;
      this.currentTask = legacyState.currentTask;
      this.abortController = legacyState.abortController;

      this.processQueue();
    }
  }

  private async runDesktopFallbackFromUIA(
    task: string,
    options: DesktopTaskExecutionOptions | undefined,
    runResult: WindowsUIAFallbackRunResult,
  ): Promise<string> {
    return runUIAFallback({
      task,
      options,
      runResult,
      emit: (eventName: string, payload?: unknown) => { this.emit(eventName, payload); },
      executeDesktopTask: (fallbackTask: string, fallbackOptions?: DesktopTaskExecutionOptions) => this.executeTask(fallbackTask, fallbackOptions),
    });
  }

  private async proactiveRecovery(
    task: string, screenshotBase64: string, reason: 'stuck' | 'fail' | 'failures', failMessage?: string,
  ): Promise<boolean> {
    console.log(`[DesktopAgent] Recuperacion proactiva solicitada - razon: ${reason}`);
    return executeProactiveRecovery({
      task,
      screenshotBase64,
      reason,
      failMessage,
      ai: this.getGenAI(),
      config: this.config,
      currentPlan: this.currentPlan,
      actionHistory: this.actionHistory,
      recovery: this.recovery,
      currentStep: this.currentStep,
      abortSignal: this.abortController?.signal ?? null,
      emit: (eventName, payload) => { this.emit(eventName, payload); },
      setStatus: (status) => { this.status = status; },
      executeAction: (action) => this.executeAction(action),
      delay: (ms) => this.delay(ms),
      getErrorMessage,
    });
  }

  async startObservation(objective: string, reactionRules?: string): Promise<void> {
    if (this.observationInterval) this.stopObservation();
    if (!this.apiKey) throw new Error('API key de Gemini no configurada.');

    this.status = 'observing';
    this.calculateScreenScale();

    console.log(`[DesktopAgent] Modo observación: "${objective}"`);
    this.emit('observation-started', { objective });
    this.observationInterval = startContinuousObservation({
      objective,
      reactionRules,
      intervalMs: this.config.continuousObservationInterval,
      modelName: this.config.model,
      ai: this.getGenAI(),
      isRunning: () => this.observationRunning,
      setRunning: (running) => { this.observationRunning = running; },
      takeScreenshot: () => this.takeScreenshot(),
      quickHash: (base64) => this.quickHash(base64),
      executeAction: (action) => this.executeAction(action),
      emit: (eventName, payload) => { this.emit(eventName, payload); },
      getErrorMessage,
    });
  }

  stopObservation(): void {
    if (this.observationInterval) {
      clearInterval(this.observationInterval);
      this.observationInterval = null;
    }
    this.observationRunning = false;
    this.status = 'idle';
    this.emit('observation-stopped');
    console.log('[DesktopAgent] Observación detenida.');
  }

  private async visionStep(task: string, screenshotBase64: string, useFallback = false, recoveryContext = false): Promise<DesktopActionPayload> {
    const modelId = useFallback ? this.config.fallbackModel : this.config.model;
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: modelId });

    const prompt = buildVisionPrompt({
      task,
      recoveryContext,
      historyContext: buildHistoryContext(this.actionHistory, this.config),
      strategicPlan: this.strategicPlan,
      currentPlan: this.currentPlan,
      recovery: this.recovery,
      historySummaries: this.historySummaries,
      hasZoomImage: Boolean(this.lastZoomImage),
      captureMode: this.captureMode,
      currentUIElements: this.currentUIElements,
      screenshotWidth: this.lastActualScreenshotWidth || this.config.screenshotWidth,
      screenshotHeight: this.lastActualScreenshotHeight || this.config.screenshotHeight,
      monitorContext: this.describeScreenshotMonitorContext(),
      currentStep: this.currentStep,
      config: this.config,
    });

    const parts: VisionContentPart[] = [
      { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
    ];
    if (this.lastZoomImage) {
      parts.push({ inlineData: { mimeType: 'image/png', data: this.lastZoomImage } });
      this.lastZoomImage = null; // Consumed — will be regenerated if zoom action is used again
    }
    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    return parseVisionResponse(result.response.text());
  }

  private async createPlan(task: string, screenshotBase64: string): Promise<TaskPlan> {
    const { taskPlan, strategicPlan } = await createDesktopTaskPlan({
      ai: this.getGenAI(),
      config: this.config,
      task,
      screenshotBase64,
    });

    this.strategicPlan = strategicPlan;
    if (strategicPlan) {
      console.log(`[DesktopAgent] Plan estratégico: ${strategicPlan.phases.length} fases, ~${strategicPlan.totalEstimatedSteps} pasos`);
      this.emit('strategic-plan-created', strategicPlan);
    }

    return taskPlan;
  }

  private async summarizeHistory(): Promise<void> {
    await summarizeDesktopHistory({
      ai: this.getGenAI(),
      modelName: this.config.model,
      actionHistory: this.actionHistory,
      currentStep: this.currentStep,
      historySummaries: this.historySummaries,
    });
  }

  private async checkPhaseCompletion(_task: string): Promise<void> {
    await checkStrategicPhaseCompletion({
      ai: this.getGenAI(),
      modelName: this.config.proactiveModel,
      screenshotBase64: await this.takeScreenshotRaw(),
      strategicPlan: this.strategicPlan,
      currentPlan: this.currentPlan,
      currentStep: this.currentStep,
      emit: (eventName, payload) => { this.emit(eventName, payload); },
    });
  }

  private async executeAction(action: DesktopActionPayload): Promise<void> {
    await executeDesktopAction(action, {
      config: this.config,
      getUIElements: () => this.currentUIElements,
      setLastZoomImage: (image) => { this.lastZoomImage = image; },
      refineActionCoordinates: (nextAction) => this.refineActionCoordinates(nextAction),
      logActionCoordinateResolution: (nextAction) => this.logActionCoordinateResolution(nextAction),
      assertActionTargetsVisibleContent: (nextAction) => this.assertActionTargetsVisibleContent(nextAction),
      mouseClick: (x, y) => this.mouseClick(x, y),
      mouseDoubleClick: (x, y) => this.mouseDoubleClick(x, y),
      mouseRightClick: (x, y) => this.mouseRightClick(x, y),
      mouseDrag: (x1, y1, x2, y2) => this.mouseDrag(x1, y1, x2, y2),
      mouseDown: (x, y) => this.mouseDown(x, y),
      mouseUp: (x, y) => this.mouseUp(x, y),
      mouseMove: (x, y) => this.mouseMove(x, y),
      mouseScroll: (direction, amount) => this.mouseScroll(direction, amount),
      keyboardType: (text) => this.keyboardType(text),
      keyboardKey: (key) => this.keyboardKey(key),
      focusWindow: (title) => this.focusWindow(title),
      minimizeWindow: (title) => this.minimizeWindow(title),
      maximizeWindow: (title) => this.maximizeWindow(title),
      restoreWindow: (title) => this.restoreWindow(title),
      closeWindow: (title) => this.closeWindow(title),
      waitForScreenChange: (timeoutMs) => this.waitForScreenChange(timeoutMs),
      waitForWindow: (title, timeoutMs) => this.waitForWindow(title, timeoutMs),
      takeZoomScreenshot: (x, y, radius) => this.takeZoomScreenshot(x, y, radius),
      mapDesktopPointToScreenshotPoint: (x, y) => this.mapDesktopPointToScreenshotPoint(x, y),
      delay: (ms) => this.delay(ms),
    });
  }

  private async smartDelay(action: DesktopActionPayload): Promise<void> {
    await applySmartActionDelay({
      action,
      defaultActionDelay: this.config.defaultActionDelay,
      waitForScreenChange: (timeoutMs) => this.waitForScreenChange(timeoutMs),
      delay: (ms) => this.delay(ms),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
