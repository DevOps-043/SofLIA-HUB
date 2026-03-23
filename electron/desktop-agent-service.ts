/**
 * DesktopAgentService — Agente autónomo de control de escritorio.
 *
 * Controla la computadora como un usuario humano: clicks, drags, escritura,
 * gestión de ventanas, navegación de diálogos de archivos, instaladores, etc.
 *
 * Arquitectura: Perception-Planning-Action (PPA) loop con Gemini Vision.
 *
 * Flujo principal:
 *   1. Captura screenshot → escala coordenadas
 *   2. Envía a Gemini con tarea + plan + historial
 *   3. Gemini retorna JSON con acción + coordenadas
 *   4. Ejecuta acción via PowerShell P/Invoke
 *   5. Espera inteligente (detecta cambio de pantalla)
 *   6. Repite hasta completar o alcanzar max pasos
 */
import { EventEmitter } from 'node:events';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { desktopCapturer, screen as electronScreen, clipboard as electronClipboard } from 'electron';
import { BrowserWebService } from './browser-web-service';
import { WindowsUIAService } from './windows-uia-service';
import {
  type DesktopAgentConfig, type DesktopActionPayload, type ActionHistoryEntry,
  type TaskPlan, type StrategicPlan, type UIElement,
  type HistorySummary, type AgentStatus, type AgentTask, type RecoveryContext,
  type DesktopAgentStatus,
  loadConfig, saveConfig,
  SEND_KEYS_MAP, PINVOKE_HEADER, LEFTDOWN, LEFTUP, RIGHTDOWN, RIGHTUP, WHEEL,
} from './desktop-agent-types';

// Re-export types for consumers
export type { DesktopAgentConfig, DesktopActionPayload, UIElement, AgentStatus, AgentTask, DesktopAgentStatus };

const execAsync = promisify(execCb);

type DesktopTaskExecutionOptions = {
  maxSteps?: number;
  startUrl?: string;
  backend?: 'auto' | 'browser' | 'desktop' | 'uia';
  browserProfile?: string;
  browserIsolated?: boolean;
  resetBrowserProfile?: boolean;
};

type ScreenshotVirtualBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScreenshotDisplayRegion = {
  displayId: string;
  bounds: ScreenshotVirtualBounds;
  left: number;
  top: number;
  width: number;
  height: number;
};

type ScreenshotLayout = {
  screenshotWidth: number;
  screenshotHeight: number;
  offsetX: number;
  offsetY: number;
  renderScale: number;
  virtualBounds: ScreenshotVirtualBounds;
  displayRegions: ScreenshotDisplayRegion[];
};

// Sharp: native module that must be loaded via require() (not ES import)
// Uses createRequire to get a working require() in ESM context
let sharpModule: any = null;
try {
  const _require = createRequire(import.meta.url);
  sharpModule = _require('sharp');
} catch (err: any) {
  console.warn('[DesktopAgent] sharp not available — overlays disabled:', err.message);
}

// ─── DesktopAgentService ────────────────────────────────────────────

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

  // ─── V2: Advanced Features ──────────────────────────────────────────
  private strategicPlan: StrategicPlan | null = null;
  private historySummaries: HistorySummary[] = [];
  private lastZoomImage: string | null = null;
  private currentUIElements: UIElement[] = [];
  private captureMode: 'som' | 'grid' = 'grid';
  private lastActualScreenshotWidth = 0;
  private lastActualScreenshotHeight = 0;
  private lastScreenshotLayout: ScreenshotLayout | null = null;

  // ─── Multi-Agent Registry ─────────────────────────────────────────
  private activeTasks: Map<string, AgentTask> = new Map();
  private taskIdCounter = 0;
  private taskQueue: Array<{ task: string; options?: DesktopTaskExecutionOptions; resolve: (v: string) => void; reject: (e: Error) => void }> = [];
  private browserWeb = new BrowserWebService();
  private windowsUIA = new WindowsUIAService(this);

  constructor() {
    super();
    this.config = loadConfig();
    this.registerBrowserEventForwarding();
    this.registerWindowsUIAEventForwarding();
  }

  private generateTaskId(): string {
    return `agent-${++this.taskIdCounter}-${Date.now().toString(36)}`;
  }

  // ─── Public API ───────────────────────────────────────────────────

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
    const activeTasksList: DesktopAgentStatus['activeTasks'] = Array.from(this.activeTasks.values()).map(t => ({
      id: t.id,
      task: t.task,
      status: t.status,
      step: t.currentStep,
      maxSteps: t.maxSteps,
      backend: 'desktop_visual' as const,
      currentUrl: null,
    }));

    const browserStatus = this.browserWeb.getStatus();
    const windowsUIAStatus = this.windowsUIA.getStatus();
    if (browserStatus.status !== 'idle') {
      activeTasksList.push({
        id: 'browser-web',
        task: browserStatus.currentTask || 'Tarea web',
        status: 'executing',
        step: browserStatus.currentStep,
        maxSteps: browserStatus.maxSteps || this.config.maxSteps,
        backend: 'browser_web',
        currentUrl: browserStatus.currentUrl,
        browserProfileId: browserStatus.currentProfileId,
        browserProfileMode: browserStatus.currentProfileMode,
      });
    }
    if (windowsUIAStatus.status !== 'idle') {
      activeTasksList.push({
        id: 'windows-uia',
        task: windowsUIAStatus.currentTask || 'Tarea nativa',
        status: 'executing',
        step: windowsUIAStatus.currentStep,
        maxSteps: windowsUIAStatus.maxSteps || this.config.maxSteps,
        backend: 'windows_uia',
        currentUrl: null,
      });
    }

    const lastDesktopAction = this.actionHistory.length > 0
      ? this.actionHistory[this.actionHistory.length - 1].action.message
      : null;
    const currentBackend = browserStatus.status !== 'idle'
      ? 'browser_web'
      : windowsUIAStatus.status !== 'idle'
        ? 'windows_uia'
        : (this.currentTask ? 'desktop_visual' : null);
    const currentTask = browserStatus.status !== 'idle'
      ? browserStatus.currentTask
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.currentTask
        : this.currentTask;
    const currentStep = browserStatus.status !== 'idle'
      ? browserStatus.currentStep
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.currentStep
        : this.currentStep;
    const maxSteps = browserStatus.status !== 'idle'
      ? (browserStatus.maxSteps || this.config.maxSteps)
      : windowsUIAStatus.status !== 'idle'
        ? (windowsUIAStatus.maxSteps || this.config.maxSteps)
        : this.config.maxSteps;
    const lastVerification = browserStatus.status !== 'idle'
      ? browserStatus.lastVerification
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.lastVerification
        : (browserStatus.lastVerification || windowsUIAStatus.lastVerification || null);
    const lastTracePath = browserStatus.status !== 'idle'
      ? browserStatus.lastTracePath
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.lastTracePath
        : (browserStatus.lastTracePath || windowsUIAStatus.lastTracePath || null);
    const lastReportPath = browserStatus.status !== 'idle'
      ? browserStatus.lastReportPath
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.lastReportPath
        : (browserStatus.lastReportPath || windowsUIAStatus.lastReportPath || null);
    const lastScreenshotPath = browserStatus.status !== 'idle'
      ? browserStatus.lastScreenshotPath
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.lastScreenshotPath
        : (browserStatus.lastScreenshotPath || windowsUIAStatus.lastScreenshotPath || null);
    const lastAction = browserStatus.status !== 'idle'
      ? browserStatus.lastAction
      : windowsUIAStatus.status !== 'idle'
        ? windowsUIAStatus.lastAction
        : (browserStatus.lastAction || windowsUIAStatus.lastAction || lastDesktopAction);

    return {
      status: browserStatus.status !== 'idle' || windowsUIAStatus.status !== 'idle' ? 'executing' : this.status,
      currentTask: currentTask || null,
      currentStep,
      maxSteps,
      currentBackend,
      currentUrl: browserStatus.status !== 'idle' ? browserStatus.currentUrl : null,
      currentBrowserProfileId: browserStatus.currentProfileId,
      currentBrowserProfileMode: browserStatus.currentProfileMode,
      lastVerification,
      lastTracePath,
      lastReportPath,
      lastScreenshotPath,
      plan: this.currentPlan ? { ...this.currentPlan } : null,
      lastAction,
      config: this.getConfig(),
      activeTasks: activeTasksList,
      totalActiveAgents: activeTasksList.length,
    };
  }

  abort(taskId?: string): void {
    if (taskId) {
      if (taskId === 'browser-web') {
        this.browserWeb.abortAll();
        this.emit('task-aborted', { taskId });
        return;
      }
      if (taskId === 'windows-uia') {
        this.windowsUIA.abortAll();
        this.emit('task-aborted', { taskId });
        return;
      }
      // Abort a specific task
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.abortController.abort();
        task.status = 'idle';
        task.completedAt = Date.now();
        this.activeTasks.delete(taskId);
        console.log(`[DesktopAgent] Tarea ${taskId} cancelada.`);
        this.emit('task-aborted', { taskId });
        this.processQueue();
      }
    } else {
      // Abort all tasks
      for (const [id, task] of this.activeTasks) {
        task.abortController.abort();
        task.status = 'idle';
        task.completedAt = Date.now();
        this.activeTasks.delete(id);
      }
      if (this.abortController) {
        this.abortController.abort();
      }
      this.browserWeb.abortAll();
      this.windowsUIA.abortAll();
      this.stopObservation();
      console.log('[DesktopAgent] Todas las tareas canceladas.');
    }
  }

  abortAll(): void { this.abort(); }

  isRunning(): boolean {
    return this.status !== 'idle' || this.activeTasks.size > 0 || this.browserWeb.isRunning() || this.windowsUIA.isRunning();
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size + (this.browserWeb.isRunning() ? 1 : 0) + (this.windowsUIA.isRunning() ? 1 : 0);
  }

  listBrowserProfiles() {
    return this.browserWeb.listProfiles();
  }

  async resetBrowserProfile(profileId: string) {
    return this.browserWeb.resetProfile(profileId);
  }

  // ─── Screenshot ───────────────────────────────────────────────────

  async takeScreenshot(fullRes = false): Promise<string> {
    const captureTarget = fullRes
      ? { width: 1920, height: 1080 }
      : { width: this.config.screenshotWidth, height: this.config.screenshotHeight };
    const captured = await this.captureCompositeScreenshot(captureTarget.width, captureTarget.height);
    const capturedBase64 = captured.base64;

    if (!fullRes) {
      this.updateScreenScale(captured.actualWidth, captured.actualHeight);
    }

    if (this.config.gridEnabled && !fullRes) {
      try {
        return await this.applyGridOverlay(capturedBase64, captured.actualWidth, captured.actualHeight);
      } catch (err: any) {
        console.warn(`[DesktopAgent] Grid overlay fallÃ³, usando raw:`, err.message);
        return capturedBase64;
      }
    }
    return capturedBase64;

    const size = fullRes
      ? { width: 1920, height: 1080 }
      : { width: this.config.screenshotWidth, height: this.config.screenshotHeight };
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: size,
    });
    if (sources.length === 0) throw new Error('No se encontraron pantallas.');
    const thumbnail = sources[0].thumbnail;
    const actualSize = thumbnail.getSize();
    const dataUrl = thumbnail.toDataURL();
    const rawBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    // Update screen scale based on ACTUAL thumbnail dimensions (may differ from requested)
    if (!fullRes) {
      this.updateScreenScale(actualSize.width, actualSize.height);
    }

    // V2: Apply grid overlay for coordinate reference
    if (this.config.gridEnabled && !fullRes) {
      try {
        return await this.applyGridOverlay(rawBase64, actualSize.width, actualSize.height);
      } catch (err: any) {
        console.warn(`[DesktopAgent] Grid overlay falló, usando raw:`, err.message);
        return rawBase64; // Fallback to raw if sharp fails
      }
    }
    return rawBase64;
  }

  // V2: Apply Set-of-Marks overlay if elements are available, otherwise grid
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
      } catch (err: any) { console.warn(`[DesktopAgent] SoM overlay falló, fallback a grid:`, err.message); }
    }

    // Fallback to grid
    this.currentUIElements = [];
    this.captureMode = 'grid';
    const gridded = this.config.gridEnabled
      ? await this.applyGridOverlay(rawScreenshot, width, height).catch((err: any) => { console.warn(`[DesktopAgent] Grid fallback falló:`, err.message); return rawScreenshot; })
      : rawScreenshot;
    return { screenshot: gridded, elements: [], mode: 'grid' };
  }

  // Raw screenshot without overlays
  private async takeScreenshotRaw(): Promise<string> {
    const composite = await this.captureCompositeScreenshot(
      this.config.screenshotWidth,
      this.config.screenshotHeight,
    );
    this.updateScreenScale(composite.actualWidth, composite.actualHeight);
    return composite.base64;

    const size = { width: this.config.screenshotWidth, height: this.config.screenshotHeight };
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
    if (sources.length === 0) throw new Error('No se encontraron pantallas.');
    const thumbnail = sources[0].thumbnail;
    const actualSize = thumbnail.getSize();
    this.updateScreenScale(actualSize.width, actualSize.height);
    return thumbnail.toDataURL().replace(/^data:image\/png;base64,/, '');
  }

  // V2: Grid overlay using sharp (ported from monitoring-service.ts)
  private async applyGridOverlay(base64: string, _width: number, _height: number): Promise<string> {
    if (!sharpModule) return base64; // Sharp not available — return raw
    const pngBuffer = Buffer.from(base64, 'base64');
    // Read ACTUAL image dimensions (desktopCapturer may not respect thumbnailSize)
    const meta = await sharpModule(pngBuffer).metadata();
    const width = meta.width || _width;
    const height = meta.height || _height;

    const step = this.config.gridStep;
    let svgElements = '';
    for (let x = 0; x < width; x += step) {
      svgElements += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
      svgElements += `<text x="${x + 2}" y="12" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${x}</text>`;
    }
    for (let y = 0; y < height; y += step) {
      svgElements += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
      svgElements += `<text x="2" y="${y + 12}" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${y}</text>`;
    }
    const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
    const result = await sharpModule(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer();
    return result.toString('base64');
  }

  // V2: Set-of-Marks overlay with numbered bounding boxes
  private async applySoMOverlay(base64: string, _width: number, _height: number, elements: UIElement[]): Promise<string> {
    if (!sharpModule) return base64; // Sharp not available — return raw
    const pngBuffer = Buffer.from(base64, 'base64');
    // Read ACTUAL image dimensions
    const meta = await sharpModule(pngBuffer).metadata();
    const width = meta.width || _width;
    const height = meta.height || _height;

    const colorMap: Record<string, string> = {
      Button: '#22c55e', TextBox: '#3b82f6', Edit: '#3b82f6',
      MenuItem: '#f97316', ComboBox: '#a855f7', ListItem: '#06b6d4',
      Link: '#ec4899', CheckBox: '#eab308', RadioButton: '#eab308',
    };
    let svgElements = '';
    for (const el of elements.slice(0, 30)) { // Max 30 markers to avoid clutter
      const mappedRect = this.mapDesktopRectToScreenshotRect(el.boundingRect);
      if (!mappedRect) continue;
      const bx = Math.round(mappedRect.x);
      const by = Math.round(mappedRect.y);
      const bw = Math.max(Math.round(mappedRect.width), 8);
      const bh = Math.max(Math.round(mappedRect.height), 8);
      const color = colorMap[el.controlType] || '#ef4444';

      svgElements += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${color}" stroke-width="2" rx="2"/>`;
      svgElements += `<rect x="${bx}" y="${Math.max(0, by - 14)}" width="${String(el.id).length * 8 + 6}" height="14" fill="${color}" rx="2"/>`;
      svgElements += `<text x="${bx + 3}" y="${Math.max(10, by - 3)}" fill="white" font-size="10" font-weight="bold" font-family="monospace">${el.id}</text>`;
    }

    const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
    const result = await sharpModule(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer();
    return result.toString('base64');
  }

  // V2: Zoom into a specific region at high resolution
  async takeZoomScreenshot(centerX: number, centerY: number, radius = 150): Promise<string> {
    if (!sharpModule) {
      console.warn('[DesktopAgent] Zoom requiere sharp â€” retornando screenshot completo');
      return this.takeScreenshotRaw();
    }
    const zoomDipPoint = this.mapScreenshotToDipPoint(centerX, centerY);
    const zoomCapture = await this.captureCompositeScreenshot(1920, 1080);
    const zoomBuffer = Buffer.from(zoomCapture.base64, 'base64');
    const zoomMeta = await sharpModule(zoomBuffer).metadata();
    const zoomFullW = zoomMeta.width || 1920;
    const zoomFullH = zoomMeta.height || 1080;
    const zoomMappedPoint = zoomDipPoint
      ? this.mapDipPointToScreenshotPoint(zoomDipPoint.x, zoomDipPoint.y, zoomCapture.layout)
      : null;
    const zoomFx = Math.round(zoomMappedPoint?.x ?? (zoomFullW / 2));
    const zoomFy = Math.round(zoomMappedPoint?.y ?? (zoomFullH / 2));
    const zoomFr = Math.round((radius / this.config.screenshotWidth) * zoomFullW);

    const zoomLeft = Math.max(0, zoomFx - zoomFr);
    const zoomTop = Math.max(0, zoomFy - zoomFr);
    const zoomCropW = Math.min(zoomFr * 2, zoomFullW - zoomLeft);
    const zoomCropH = Math.min(zoomFr * 2, zoomFullH - zoomTop);

    const zoomOutputSize = this.config.zoomResolution;
    let zoomCropped = await sharpModule(zoomBuffer)
      .extract({ left: zoomLeft, top: zoomTop, width: zoomCropW, height: zoomCropH })
      .resize(zoomOutputSize, zoomOutputSize, { fit: 'fill' })
      .toBuffer();

    const zoomFineStep = 25;
    let zoomFineGrid = '';
    for (let gx = 0; gx < zoomOutputSize; gx += zoomFineStep) {
      zoomFineGrid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${zoomOutputSize}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
    }
    for (let gy = 0; gy < zoomOutputSize; gy += zoomFineStep) {
      zoomFineGrid += `<line x1="0" y1="${gy}" x2="${zoomOutputSize}" y2="${gy}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
    }
    zoomFineGrid += `<line x1="${zoomOutputSize / 2}" y1="0" x2="${zoomOutputSize / 2}" y2="${zoomOutputSize}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;
    zoomFineGrid += `<line x1="0" y1="${zoomOutputSize / 2}" x2="${zoomOutputSize}" y2="${zoomOutputSize / 2}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;

    const zoomGridSvg = Buffer.from(`<svg width="${zoomOutputSize}" height="${zoomOutputSize}" xmlns="http://www.w3.org/2000/svg">${zoomFineGrid}</svg>`);
    zoomCropped = await sharpModule(zoomCropped).composite([{ input: zoomGridSvg, top: 0, left: 0 }]).toBuffer();

    return zoomCropped.toString('base64');

    if (!sharpModule) {
      // Without sharp, just return the full screenshot as fallback
      console.warn('[DesktopAgent] Zoom requiere sharp — retornando screenshot completo');
      return this.takeScreenshotRaw();
    }

    // Capture at full native resolution
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources.length === 0) throw new Error('No se encontraron pantallas.');
    const fullBase64 = sources[0].thumbnail.toDataURL().replace(/^data:image\/png;base64,/, '');
    const fullBuffer = Buffer.from(fullBase64, 'base64');

    // Scale center coordinates from screenshot space to full resolution
    const meta = await sharpModule(fullBuffer).metadata();
    const fullW = meta.width || 1920;
    const fullH = meta.height || 1080;
    const fx = Math.round((centerX / this.config.screenshotWidth) * fullW);
    const fy = Math.round((centerY / this.config.screenshotHeight) * fullH);
    const fr = Math.round((radius / this.config.screenshotWidth) * fullW);

    // Compute crop region (clamped to image bounds)
    const left = Math.max(0, fx - fr);
    const top = Math.max(0, fy - fr);
    const cropW = Math.min(fr * 2, fullW - left);
    const cropH = Math.min(fr * 2, fullH - top);

    // Crop and resize to zoomResolution with fine grid
    const zoomSize = this.config.zoomResolution;
    let cropped = await sharpModule(fullBuffer).extract({ left, top, width: cropW, height: cropH }).resize(zoomSize, zoomSize, { fit: 'fill' }).toBuffer();

    // Apply fine grid (25px step) on zoom
    const fineStep = 25;
    let fineGrid = '';
    for (let gx = 0; gx < zoomSize; gx += fineStep) {
      fineGrid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${zoomSize}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
    }
    for (let gy = 0; gy < zoomSize; gy += fineStep) {
      fineGrid += `<line x1="0" y1="${gy}" x2="${zoomSize}" y2="${gy}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
    }
    // Add center crosshair
    fineGrid += `<line x1="${zoomSize / 2}" y1="0" x2="${zoomSize / 2}" y2="${zoomSize}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;
    fineGrid += `<line x1="0" y1="${zoomSize / 2}" x2="${zoomSize}" y2="${zoomSize / 2}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;

    const gridSvg = Buffer.from(`<svg width="${zoomSize}" height="${zoomSize}" xmlns="http://www.w3.org/2000/svg">${fineGrid}</svg>`);
    cropped = await sharpModule(cropped).composite([{ input: gridSvg, top: 0, left: 0 }]).toBuffer();

    return cropped.toString('base64');
  }

  private getVirtualDesktopBounds(): ScreenshotVirtualBounds {
    const displays = electronScreen.getAllDisplays();
    if (!displays.length) {
      return { x: 0, y: 0, width: 1920, height: 1080 };
    }

    const minX = Math.min(...displays.map((display) => display.bounds.x));
    const minY = Math.min(...displays.map((display) => display.bounds.y));
    const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
    const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  private intersectBounds(a: ScreenshotVirtualBounds, b: ScreenshotVirtualBounds): ScreenshotVirtualBounds | null {
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);

    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }

  private async getForegroundWindowBounds(): Promise<{ title: string; process: string; bounds: ScreenshotVirtualBounds } | null> {
    try {
      const stdout = await this.psEncoded(`
$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace W {
  public static class FgWin {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
}
"@

Add-Type -TypeDefinition $source

$hwnd = [W.FgWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  @{} | ConvertTo-Json -Compress
  exit
}

$sb = New-Object System.Text.StringBuilder 1024
[void][W.FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$rect = New-Object W.FgWin+RECT
[void][W.FgWin]::GetWindowRect($hwnd, [ref]$rect)
$pid = [uint32]0
[void][W.FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

@{
  title = $sb.ToString()
  process = if ($proc) { $proc.ProcessName } else { '' }
  x = $rect.Left
  y = $rect.Top
  width = [Math]::Max(0, $rect.Right - $rect.Left)
  height = [Math]::Max(0, $rect.Bottom - $rect.Top)
} | ConvertTo-Json -Compress
`, 3000);

      const parsed = JSON.parse(stdout || '{}') as {
        title?: string;
        process?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };

      const width = Number(parsed.width || 0);
      const height = Number(parsed.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 120) {
        return null;
      }

      return {
        title: String(parsed.title || ''),
        process: String(parsed.process || ''),
        bounds: {
          x: Number(parsed.x || 0),
          y: Number(parsed.y || 0),
          width,
          height,
        },
      };
    } catch {
      return null;
    }
  }

  private async getFocusedCaptureBounds(): Promise<ScreenshotVirtualBounds | null> {
    if (!this.config.focusedCaptureEnabled) {
      return null;
    }

    const focusedWindow = await this.getForegroundWindowBounds();
    if (!focusedWindow) {
      return null;
    }

    const normalizedTitle = `${focusedWindow.title} ${focusedWindow.process}`.toLowerCase();
    if (!normalizedTitle.trim() || normalizedTitle.includes('program manager')) {
      return null;
    }

    const padding = Math.max(0, this.config.focusedCapturePadding || 0);
    const paddedBounds: ScreenshotVirtualBounds = {
      x: focusedWindow.bounds.x - padding,
      y: focusedWindow.bounds.y - padding,
      width: focusedWindow.bounds.width + (padding * 2),
      height: focusedWindow.bounds.height + (padding * 2),
    };

    return this.intersectBounds(this.getVirtualDesktopBounds(), paddedBounds);
  }

  private buildScreenshotLayout(targetWidth: number, targetHeight: number, captureBounds?: ScreenshotVirtualBounds | null): ScreenshotLayout {
    const virtualBounds = captureBounds || this.getVirtualDesktopBounds();
    const renderScale = Math.min(
      targetWidth / virtualBounds.width,
      targetHeight / virtualBounds.height,
    );
    const contentWidth = Math.max(1, Math.round(virtualBounds.width * renderScale));
    const contentHeight = Math.max(1, Math.round(virtualBounds.height * renderScale));
    const offsetX = Math.max(0, Math.floor((targetWidth - contentWidth) / 2));
    const offsetY = Math.max(0, Math.floor((targetHeight - contentHeight) / 2));

    return {
      screenshotWidth: targetWidth,
      screenshotHeight: targetHeight,
      offsetX,
      offsetY,
      renderScale,
      virtualBounds,
      displayRegions: electronScreen.getAllDisplays().reduce<ScreenshotDisplayRegion[]>((regions, display) => {
        const intersection = this.intersectBounds(
          {
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
          },
          virtualBounds,
        );

        if (!intersection) {
          return regions;
        }

        regions.push({
          displayId: String(display.id),
          bounds: intersection,
          left: Math.round((intersection.x - virtualBounds.x) * renderScale) + offsetX,
          top: Math.round((intersection.y - virtualBounds.y) * renderScale) + offsetY,
          width: Math.max(1, Math.round(intersection.width * renderScale)),
          height: Math.max(1, Math.round(intersection.height * renderScale)),
        });
        return regions;
      }, []),
    };
  }

  private async captureCompositeScreenshot(targetWidth: number, targetHeight: number): Promise<{
    base64: string;
    layout: ScreenshotLayout;
    actualWidth: number;
    actualHeight: number;
  }> {
    const displays = electronScreen.getAllDisplays();
    const thumbnailSize = {
      width: Math.max(targetWidth, 1600),
      height: Math.max(targetHeight, 900),
    };
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize,
    });
    if (sources.length === 0) throw new Error('No se encontraron pantallas.');

    const focusedCaptureBounds = await this.getFocusedCaptureBounds();
    const layout = this.buildScreenshotLayout(targetWidth, targetHeight, focusedCaptureBounds);
    this.lastScreenshotLayout = layout;
    this.lastActualScreenshotWidth = targetWidth;
    this.lastActualScreenshotHeight = targetHeight;

    if (!sharpModule || sources.length === 1) {
      const fallback = sources[0].thumbnail;
      const fallbackSize = fallback.getSize();
      return {
        base64: fallback.toDataURL().replace(/^data:image\/png;base64,/, ''),
        layout,
        actualWidth: fallbackSize.width || targetWidth,
        actualHeight: fallbackSize.height || targetHeight,
      };
    }

    const sourceByDisplayId = new Map<string, any>();
    const displayById = new Map<string, Electron.Display>();
    for (const source of sources) {
      if (source.display_id) {
        sourceByDisplayId.set(String(source.display_id), source);
      }
    }
    for (const display of displays) {
      displayById.set(String(display.id), display);
    }

    const orderedSources = [...sources];
    const composites: Array<{ input: Buffer; left: number; top: number }> = [];
    for (const [index, region] of layout.displayRegions.entries()) {
      const source = sourceByDisplayId.get(region.displayId) || orderedSources[index] || orderedSources[0];
      if (!source?.thumbnail) continue;
      const sourcePng = source.thumbnail.toPNG();
      const display = displayById.get(region.displayId);
      let pipeline = sharpModule(sourcePng);

      if (display) {
        const metadata = await sharpModule(sourcePng).metadata();
        const sourceWidth = metadata.width || thumbnailSize.width;
        const sourceHeight = metadata.height || thumbnailSize.height;
        const scaleX = sourceWidth / Math.max(1, display.bounds.width);
        const scaleY = sourceHeight / Math.max(1, display.bounds.height);
        const cropLeft = Math.max(0, region.bounds.x - display.bounds.x);
        const cropTop = Math.max(0, region.bounds.y - display.bounds.y);
        const cropWidth = Math.min(region.bounds.width, display.bounds.width - cropLeft);
        const cropHeight = Math.min(region.bounds.height, display.bounds.height - cropTop);
        const extractLeft = Math.max(0, Math.min(sourceWidth - 1, Math.round(cropLeft * scaleX)));
        const extractTop = Math.max(0, Math.min(sourceHeight - 1, Math.round(cropTop * scaleY)));
        const extractWidth = Math.max(1, Math.min(sourceWidth - extractLeft, Math.round(cropWidth * scaleX)));
        const extractHeight = Math.max(1, Math.min(sourceHeight - extractTop, Math.round(cropHeight * scaleY)));
        pipeline = pipeline.extract({
          left: extractLeft,
          top: extractTop,
          width: extractWidth,
          height: extractHeight,
        });
      }

      const resized = await pipeline.resize(region.width, region.height, { fit: 'fill' }).toBuffer();
      composites.push({
        input: resized,
        left: region.left,
        top: region.top,
      });
    }

    const result = await sharpModule({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 4,
        background: { r: 18, g: 18, b: 18, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    return {
      base64: result.toString('base64'),
      layout,
      actualWidth: targetWidth,
      actualHeight: targetHeight,
    };
  }

  private dipToScreenPoint(point: { x: number; y: number }): { x: number; y: number } {
    try {
      const converted = (electronScreen as any).dipToScreenPoint?.({
        x: Math.round(point.x),
        y: Math.round(point.y),
      });
      if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) {
        return {
          x: Math.round(converted.x),
          y: Math.round(converted.y),
        };
      }
    } catch {
      // Fallback below.
    }

    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  }

  private screenToDipPoint(point: { x: number; y: number }): { x: number; y: number } {
    try {
      const converted = (electronScreen as any).screenToDipPoint?.({
        x: Math.round(point.x),
        y: Math.round(point.y),
      });
      if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) {
        return {
          x: converted.x,
          y: converted.y,
        };
      }
    } catch {
      // Fallback below.
    }

    return { x: point.x, y: point.y };
  }

  private mapScreenshotToDipPoint(
    x: number,
    y: number,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): { x: number; y: number } | null {
    if (!layout) return null;

    const relativeX = Math.max(0, Math.min(layout.virtualBounds.width, (x - layout.offsetX) / layout.renderScale));
    const relativeY = Math.max(0, Math.min(layout.virtualBounds.height, (y - layout.offsetY) / layout.renderScale));
    return {
      x: layout.virtualBounds.x + relativeX,
      y: layout.virtualBounds.y + relativeY,
    };
  }

  public mapDipPointToScreenshotPoint(
    x: number,
    y: number,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): { x: number; y: number } | null {
    if (!layout) return null;

    return {
      x: ((x - layout.virtualBounds.x) * layout.renderScale) + layout.offsetX,
      y: ((y - layout.virtualBounds.y) * layout.renderScale) + layout.offsetY,
    };
  }

  public mapDesktopPointToScreenshotPoint(x: number, y: number): { x: number; y: number } | null {
    const dipPoint = this.screenToDipPoint({ x, y });
    return this.mapDipPointToScreenshotPoint(dipPoint.x, dipPoint.y);
  }

  public mapDesktopRectToScreenshotRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } | null {
    const topLeft = this.mapDesktopPointToScreenshotPoint(rect.x, rect.y);
    const bottomRight = this.mapDesktopPointToScreenshotPoint(rect.x + rect.width, rect.y + rect.height);
    if (!topLeft || !bottomRight) return null;

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
      height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
    };
  }

  // V2: Get interactive UI elements using Windows UI Automation
  async getUIElements(): Promise<UIElement[]> {
    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -Name FgWin -Namespace W -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow();'
$hwnd = [W.FgWin]::GetForegroundWindow()
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$result = @()
$id = 1
$interestingTypes = @('Button','Edit','TextBox','Hyperlink','MenuItem','ListItem','TreeItem','TabItem','Document','CheckBox','RadioButton','ComboBox','DataItem')
foreach ($el in $elements) {
  $rect = $el.Current.BoundingRectangle
  $controlType = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\\.', ''
  $hasInteractivePattern = (
    $el.Current.IsInvokePatternAvailable -or
    $el.Current.IsValuePatternAvailable -or
    $el.Current.IsTogglePatternAvailable -or
    $el.Current.IsSelectionItemPatternAvailable -or
    $el.Current.IsExpandCollapsePatternAvailable -or
    $el.Current.IsScrollItemPatternAvailable -or
    $el.Current.IsTextPatternAvailable
  )
  $looksInteractive = $interestingTypes -contains $controlType
  $hasIdentity = -not [string]::IsNullOrWhiteSpace($el.Current.Name) -or -not [string]::IsNullOrWhiteSpace($el.Current.AutomationId)
  if (
    $rect.Width -gt 0 -and
    $rect.Height -gt 0 -and
    $rect.Width -lt 2000 -and
    $rect.Height -lt 2000 -and
    -not $el.Current.IsOffscreen -and
    ($hasInteractivePattern -or $looksInteractive -or $hasIdentity)
  ) {
    $value = ''
    try {
      $vp = $null
      if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and $vp) {
        $value = $vp.Current.Value
      }
    } catch {}
    $result += @{
      id = $id
      name = $el.Current.Name
      controlType = $controlType
      x = [int]$rect.X
      y = [int]$rect.Y
      width = [int]$rect.Width
      height = [int]$rect.Height
      isEnabled = $el.Current.IsEnabled
      automationId = $el.Current.AutomationId
      value = $value
    }
    $id++
    if ($id -gt 60) { break }
  }
}
$result | ConvertTo-Json -Compress -Depth 3
"`, { timeout: 4000, windowsHide: true });

      const parsed = JSON.parse(stdout || '[]');
      const arr: UIElement[] = (Array.isArray(parsed) ? parsed : [parsed])
        .filter((e: any) => e && e.id)
        .map((e: any) => ({
          id: e.id,
          name: e.name || '',
          controlType: e.controlType || 'Unknown',
          boundingRect: { x: e.x || 0, y: e.y || 0, width: e.width || 0, height: e.height || 0 },
          isEnabled: e.isEnabled !== false,
          automationId: e.automationId || '',
          value: e.value || '',
        }))
        .sort((a, b) => {
          const deltaY = a.boundingRect.y - b.boundingRect.y;
          if (Math.abs(deltaY) > 12) {
            return deltaY;
          }
          return a.boundingRect.x - b.boundingRect.x;
        });
      return arr;
    } catch (err: any) {
      console.warn(`[DesktopAgent] UI Automation falló:`, err.message);
      return [];
    }
  }

  // ─── Coordinate Scaling ───────────────────────────────────────────

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

  // Update screen scale based on ACTUAL screenshot dimensions from desktopCapturer
  private updateScreenScale(actualWidth: number, actualHeight: number): void {
    this.lastActualScreenshotWidth = actualWidth;
    this.lastActualScreenshotHeight = actualHeight;
    try {
      const layout = this.lastScreenshotLayout ?? this.buildScreenshotLayout(actualWidth, actualHeight);
      this.lastScreenshotLayout = layout;
      const virtualBounds = layout.virtualBounds;
      const newScaleX = virtualBounds.width / actualWidth;
      const newScaleY = virtualBounds.height / actualHeight;

      // Only log on first call or if scale changed
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
    if (!layout) return null;

    const regionIndex = layout.displayRegions.findIndex((region) => (
      x >= region.left
      && x <= (region.left + region.width)
      && y >= region.top
      && y <= (region.top + region.height)
    ));

    if (regionIndex === -1) {
      return layout.offsetX > 0 || layout.offsetY > 0 ? 'padding' : null;
    }

    const region = layout.displayRegions[regionIndex];
    return `monitor ${regionIndex + 1} (display ${region.displayId})`;
  }

  private describeScreenshotMonitorContext(layout: ScreenshotLayout | null = this.lastScreenshotLayout): string {
    if (!layout) return '';
    const desktopBounds = this.getVirtualDesktopBounds();
    const hasMultipleDisplays = layout.displayRegions.length > 1;
    const hasPadding = layout.offsetX > 0 || layout.offsetY > 0;
    const isFocusedCrop =
      layout.virtualBounds.x !== desktopBounds.x
      || layout.virtualBounds.y !== desktopBounds.y
      || layout.virtualBounds.width !== desktopBounds.width
      || layout.virtualBounds.height !== desktopBounds.height;
    if (!hasMultipleDisplays && !hasPadding && !isFocusedCrop) return '';

    const regions = layout.displayRegions
      .map((region, index) => {
        const right = region.left + region.width;
        const bottom = region.top + region.height;
        return `- Monitor ${index + 1}: ocupa x=${region.left}-${right}, y=${region.top}-${bottom} dentro de la imagen`;
      })
      .join('\n');
    const paddingNote = hasPadding
      ? `Fuera de esas regiones hay padding oscuro agregado por el compositor (offset ${layout.offsetX},${layout.offsetY}). Evita clickear ahi.`
      : '';
    const focusedNote = isFocusedCrop
      ? `La captura esta recortada a una region enfocada del escritorio: x=${layout.virtualBounds.x}-${layout.virtualBounds.x + layout.virtualBounds.width}, y=${layout.virtualBounds.y}-${layout.virtualBounds.y + layout.virtualBounds.height}.`
      : '';

    return `REGIONES DE MONITOR EN LA IMAGEN:
${regions}
${paddingNote}
${focusedNote}
`;
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

  private getUIElementPriority(controlType: string): number {
    switch (controlType) {
      case 'Button': return 100;
      case 'Edit':
      case 'TextBox': return 95;
      case 'ComboBox': return 90;
      case 'MenuItem':
      case 'TabItem': return 85;
      case 'CheckBox':
      case 'RadioButton': return 82;
      case 'Hyperlink': return 80;
      case 'ListItem':
      case 'TreeItem': return 76;
      case 'DataItem': return 68;
      case 'Document': return 10;
      default: return 40;
    }
  }

  private getPointDistanceToRect(
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number },
  ): number {
    const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
    const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
    return Math.hypot(dx, dy);
  }

  private snapPointToVisibleRegion(
    x: number,
    y: number,
    tolerance = 28,
    layout: ScreenshotLayout | null = this.lastScreenshotLayout,
  ): { x: number; y: number; adjusted: boolean; regionLabel?: string | null } {
    if (!layout) {
      return { x, y, adjusted: false };
    }

    const directRegion = this.getDisplayRegionLabelFromScreenshotPoint(x, y, layout);
    if (directRegion && directRegion !== 'padding') {
      return { x, y, adjusted: false, regionLabel: directRegion };
    }

    let bestCandidate: { x: number; y: number; distance: number; regionLabel: string | null } | null = null;
    for (const [index, region] of layout.displayRegions.entries()) {
      const snappedX = Math.min(Math.max(x, region.left), region.left + region.width);
      const snappedY = Math.min(Math.max(y, region.top), region.top + region.height);
      const distance = Math.hypot(snappedX - x, snappedY - y);
      const regionLabel = `monitor ${index + 1} (display ${region.displayId})`;
      if (!bestCandidate || distance < bestCandidate.distance) {
        bestCandidate = { x: snappedX, y: snappedY, distance, regionLabel };
      }
    }

    if (bestCandidate && bestCandidate.distance <= tolerance) {
      return {
        x: bestCandidate.x,
        y: bestCandidate.y,
        adjusted: true,
        regionLabel: bestCandidate.regionLabel,
      };
    }

    return { x, y, adjusted: false, regionLabel: directRegion };
  }

  private snapPointToStructuredElement(
    x: number,
    y: number,
    tolerance = 40,
  ): { x: number; y: number; element: UIElement; reason: 'inside' | 'near' } | null {
    if (this.currentUIElements.length === 0) {
      return null;
    }

    const candidates = this.currentUIElements
      .filter((element) => element.isEnabled !== false)
      .map((element) => {
        const rect = this.mapDesktopRectToScreenshotRect(element.boundingRect);
        if (!rect) return null;
        const contains = x >= rect.x && x <= (rect.x + rect.width) && y >= rect.y && y <= (rect.y + rect.height);
        const distance = this.getPointDistanceToRect(x, y, rect);
        const area = rect.width * rect.height;
        const priority = this.getUIElementPriority(element.controlType);
        return {
          element,
          rect,
          contains,
          distance,
          area,
          priority,
        };
      })
      .filter((candidate): candidate is {
        element: UIElement;
        rect: { x: number; y: number; width: number; height: number };
        contains: boolean;
        distance: number;
        area: number;
        priority: number;
      } => Boolean(candidate))
      .filter((candidate) => candidate.contains || candidate.distance <= tolerance)
      .sort((a, b) => {
        if (a.contains !== b.contains) return a.contains ? -1 : 1;
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (Math.abs(a.distance - b.distance) > 0.5) return a.distance - b.distance;
        return a.area - b.area;
      });

    const best = candidates[0];
    if (!best) {
      return null;
    }

    return {
      x: best.rect.x + (best.rect.width / 2),
      y: best.rect.y + (best.rect.height / 2),
      element: best.element,
      reason: best.contains ? 'inside' : 'near',
    };
  }

  private refineActionCoordinates(action: DesktopActionPayload): DesktopActionPayload {
    if (action.action === 'click_element' || action.action === 'type_in_element') {
      return action;
    }

    const pointActions = new Set(['click', 'double_click', 'right_click', 'type']);
    const dragAction = action.action === 'drag';

    if (!pointActions.has(action.action) && !dragAction) {
      return action;
    }

    let nextAction = action;
    const maybeAdjustPoint = (pointX: number, pointY: number, label: string): { x: number; y: number } => {
      const visiblePoint = this.snapPointToVisibleRegion(pointX, pointY);
      let adjustedX = visiblePoint.x;
      let adjustedY = visiblePoint.y;

      if (visiblePoint.adjusted) {
        console.log(`[DesktopAgent] Ajuste de coordenada ${label}: (${Math.round(pointX)}, ${Math.round(pointY)}) -> (${Math.round(adjustedX)}, ${Math.round(adjustedY)}) para salir del padding.`);
      }

      if (pointActions.has(action.action)) {
        const snappedElement = this.snapPointToStructuredElement(adjustedX, adjustedY);
        if (snappedElement) {
          adjustedX = snappedElement.x;
          adjustedY = snappedElement.y;
          console.log(
            `[DesktopAgent] Snap semantico ${label}: ${snappedElement.reason === 'inside' ? 'dentro de' : 'cerca de'} ${snappedElement.element.controlType} "${snappedElement.element.name || snappedElement.element.automationId || 'sin nombre'}" -> centro (${Math.round(adjustedX)}, ${Math.round(adjustedY)}).`,
          );
        }
      }

      return { x: adjustedX, y: adjustedY };
    };

    if (action.x !== undefined && action.y !== undefined) {
      const adjusted = maybeAdjustPoint(action.x, action.y, 'principal');
      nextAction = { ...nextAction, x: adjusted.x, y: adjusted.y };
    }

    if (dragAction && action.x2 !== undefined && action.y2 !== undefined) {
      const adjustedEnd = maybeAdjustPoint(action.x2, action.y2, 'destino');
      nextAction = { ...nextAction, x2: adjustedEnd.x, y2: adjustedEnd.y };
    }

    return nextAction;
  }

  private scale(x: number, y: number): { x: number; y: number } {
    const resolved = this.resolveScreenPoint(x, y);
    return { x: resolved.x, y: resolved.y };
  }

  private logActionCoordinateResolution(action: DesktopActionPayload): void {
    const describePoint = (label: string, x: number, y: number) => {
      const resolved = this.resolveScreenPoint(x, y);
      const dipSuffix = resolved.source === 'layout' && resolved.dipX !== undefined && resolved.dipY !== undefined
        ? ` -> dip (${resolved.dipX.toFixed(1)}, ${resolved.dipY.toFixed(1)})`
        : '';
      const regionSuffix = resolved.regionLabel ? ` [${resolved.regionLabel}]` : '';
      return `${label} img (${Math.round(x)}, ${Math.round(y)})${dipSuffix} -> screen (${resolved.x}, ${resolved.y})${regionSuffix}`;
    };

    if (action.action === 'drag' && action.x !== undefined && action.y !== undefined && action.x2 !== undefined && action.y2 !== undefined) {
      console.log(`[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('inicio', action.x, action.y)} | ${describePoint('fin', action.x2, action.y2)}`);
      return;
    }

    if (action.x !== undefined && action.y !== undefined) {
      console.log(`[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('punto', action.x, action.y)}`);
      return;
    }

    if (action.action === 'zoom') {
      const zx = action.zoomX ?? action.x;
      const zy = action.zoomY ?? action.y;
      if (zx !== undefined && zy !== undefined) {
        console.log(`[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('centro', zx, zy)}`);
      }
    }
  }

  // ─── PowerShell Helper ────────────────────────────────────────────

  private assertActionTargetsVisibleContent(action: DesktopActionPayload): void {
    const assertPoint = (label: string, x: number, y: number) => {
      const resolved = this.resolveScreenPoint(x, y);
      if (resolved.regionLabel === 'padding') {
        throw new Error(`La coordenada ${label} cae en padding fuera del contenido visible (${Math.round(x)}, ${Math.round(y)}).`);
      }
    };

    if (action.action === 'drag' && action.x !== undefined && action.y !== undefined && action.x2 !== undefined && action.y2 !== undefined) {
      assertPoint('inicio', action.x, action.y);
      assertPoint('fin', action.x2, action.y2);
      return;
    }

    if (action.action === 'zoom') {
      const zx = action.zoomX ?? action.x;
      const zy = action.zoomY ?? action.y;
      if (zx !== undefined && zy !== undefined) {
        assertPoint('zoom', zx, zy);
      }
      return;
    }

    if (action.x !== undefined && action.y !== undefined) {
      assertPoint('punto', action.x, action.y);
    }
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

  // ─── Mouse Primitives ────────────────────────────────────────────

  async mouseClick(x: number, y: number): Promise<void> {
    const s = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${s.x}, ${s.y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseDoubleClick(x: number, y: number): Promise<void> {
    await this.mouseClick(x, y);
    await this.delay(80);
    await this.mouseClick(x, y);
  }

  async mouseRightClick(x: number, y: number): Promise<void> {
    const s = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${s.x}, ${s.y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${RIGHTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${RIGHTUP},0,0,0,0)`);
  }

  async mouseDrag(x1: number, y1: number, x2: number, y2: number, durationMs = 500): Promise<void> {
    const start = this.scale(x1, y1);
    const end = this.scale(x2, y2);
    const steps = Math.max(10, Math.floor(durationMs / 16));
    const stepDelay = Math.round(durationMs / steps);

    // Generate interpolated movement
    const movements = Array.from({ length: steps }, (_, i) => {
      const t = (i + 1) / steps;
      const cx = Math.round(start.x + (end.x - start.x) * t);
      const cy = Math.round(start.y + (end.y - start.y) * t);
      return `[W.U]::SetCursorPos(${cx}, ${cy}); Start-Sleep -Milliseconds ${stepDelay}`;
    }).join('; ');

    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${start.x}, ${start.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 50
${movements}
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseDown(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
    const s = this.scale(x, y);
    const flag = button === 'left' ? LEFTDOWN : RIGHTDOWN;
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${s.x}, ${s.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${flag},0,0,0,0)`);
  }

  async mouseUp(x?: number, y?: number): Promise<void> {
    if (x !== undefined && y !== undefined) {
      const s = this.scale(x, y);
      await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${s.x}, ${s.y})
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
    } else {
      await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
    }
  }

  async mouseMove(x: number, y: number): Promise<void> {
    const s = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${s.x}, ${s.y})`);
  }

  async mouseScroll(direction: 'up' | 'down', amount = 3): Promise<void> {
    const delta = direction === 'up' ? 120 * amount : -120 * amount;
    await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${WHEEL},0,0,${delta},0)`);
  }

  // ─── Keyboard Primitives ──────────────────────────────────────────

  async keyboardType(text: string): Promise<void> {
    const savedClip = electronClipboard.readText();
    electronClipboard.writeText(text);
    await this.delay(50);
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
    await this.delay(100);
    electronClipboard.writeText(savedClip);
  }

  async keyboardKey(key: string): Promise<void> {
    const sendKey = SEND_KEYS_MAP[key.toLowerCase()] || key;
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')`);
  }

  async keyboardHotkey(...keys: string[]): Promise<void> {
    // Combine keys: e.g. keyboardHotkey('ctrl', 'shift', 'n') → '^+n'
    let combo = '';
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (lower === 'ctrl') combo += '^';
      else if (lower === 'shift') combo += '+';
      else if (lower === 'alt') combo += '%';
      else combo += lower.length === 1 ? lower : `{${lower.toUpperCase()}}`;
    }
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${combo}')`);
  }

  // ─── Window Management ────────────────────────────────────────────

  async focusWindow(titleSubstring: string): Promise<boolean> {
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, 9)
  [W.Win32]::SetForegroundWindow($proc.MainWindowHandle)
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
    return result.includes('OK');
  }

  async minimizeWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 6); // SW_MINIMIZE
  }

  async maximizeWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 3); // SW_MAXIMIZE
  }

  async restoreWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 9); // SW_RESTORE
  }

  async closeWindow(titleSubstring: string): Promise<boolean> {
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  $proc.CloseMainWindow() | Out-Null
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
    return result.includes('OK');
  }

  async listWindows(): Promise<Array<{ title: string; process: string; pid: number }>> {
    const result = await this.ps(
      `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`,
    );
    try {
      const parsed = JSON.parse(result);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((p: any) => ({
        title: p.MainWindowTitle || '',
        process: p.ProcessName || '',
        pid: p.Id || 0,
      }));
    } catch { return []; }
  }

  async getActiveWindow(): Promise<{ title: string; process: string } | null> {
    try {
      const activeWin = await import('active-win');
      const win = await activeWin.default();
      if (win) return { title: win.title, process: win.owner.name };
    } catch { /* fallback */ }
    return null;
  }

  private async windowAction(titleSubstring: string, showCmd: number): Promise<boolean> {
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, ${showCmd})
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
    return result.includes('OK');
  }

  // ─── Smart Waiting ────────────────────────────────────────────────

  async waitForScreenChange(timeoutMs?: number): Promise<boolean> {
    const timeout = timeoutMs ?? this.config.waitForChangeTimeout;
    const beforeHash = this.quickHash(await this.takeScreenshot());
    const start = Date.now();

    while (Date.now() - start < timeout) {
      await this.delay(this.config.waitForChangeInterval);
      const currentHash = this.quickHash(await this.takeScreenshot());
      if (currentHash !== beforeHash) return true;
    }
    return false;
  }

  async waitForWindow(titleSubstring: string, timeoutMs = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const windows = await this.listWindows();
      if (windows.some(w => w.title.toLowerCase().includes(titleSubstring.toLowerCase()))) {
        return true;
      }
      await this.delay(500);
    }
    return false;
  }

  private quickHash(base64: string): string {
    // Fast hash of a sampled portion of the screenshot for change detection
    const sample = base64.slice(0, 4000);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      hash = ((hash << 5) - hash) + sample.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  // ─── Multi-Agent: Queue Processing ──────────────────────────────────

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.activeTasks.size < this.config.maxConcurrentAgents) {
      const queued = this.taskQueue.shift()!;
      this.executeTaskInternal(queued.task, queued.options)
        .then(queued.resolve)
        .catch(queued.reject);
    }
  }

  /**
   * Ejecuta múltiples tareas en paralelo. Cada tarea se ejecuta secuencialmente
   * (solo una acción a la vez por seguridad de input), pero múltiples tareas
   * pueden estar "activas" — cuando una tarea espera (waitForScreenChange, waitForWindow),
   * otra tarea puede usar el mouse/teclado.
   *
   * Ejemplo: ejecutarParallelTasks(["Abre la calculadora", "Organiza los archivos en Descargas"])
   */
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

    const results = await Promise.allSettled(
      tasks.map(t => this.executeTask(t.task, {
        maxSteps: t.maxSteps,
        backend: t.backend,
        startUrl: t.startUrl,
        browserProfile: (t as any).browserProfile,
        browserIsolated: (t as any).browserIsolated,
        resetBrowserProfile: (t as any).resetBrowserProfile,
      })),
    );

    return results.map((r, i) => ({
      task: tasks[i].task,
      result: r.status === 'fulfilled' ? r.value : (r.reason?.message || 'Error desconocido'),
      success: r.status === 'fulfilled',
    }));
  }

  /**
   * Lista de tareas activas con su estado actual.
   */
  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Obtener resultado de una tarea por su ID.
   */
  getTaskResult(taskId: string): { status: AgentStatus; result?: string; error?: string } | null {
    const task = this.activeTasks.get(taskId);
    if (!task) return null;
    return { status: task.status, result: task.result, error: task.error };
  }

  private restoreLegacyStatusAfterExternalBackendEvent(): void {
    const browserStatus = this.browserWeb.getStatus();
    if (browserStatus.status !== 'idle') {
      this.status = 'executing';
      this.currentTask = browserStatus.currentTask;
      this.currentStep = browserStatus.currentStep;
      return;
    }

    const windowsUIAStatus = this.windowsUIA.getStatus();
    if (windowsUIAStatus.status !== 'idle') {
      this.status = 'executing';
      this.currentTask = windowsUIAStatus.currentTask;
      this.currentStep = windowsUIAStatus.currentStep;
      return;
    }

    if (this.activeTasks.size > 0) {
      const currentDesktopTask = Array.from(this.activeTasks.values())[0];
      this.status = currentDesktopTask.status;
      this.currentTask = currentDesktopTask.task;
      this.currentStep = currentDesktopTask.currentStep;
      return;
    }

    if (this.observationRunning) {
      this.status = 'observing';
      this.currentTask = null;
      this.currentStep = 0;
      return;
    }

    this.status = 'idle';
    this.currentTask = null;
    this.currentStep = 0;
  }

  private registerBrowserEventForwarding(): void {
    this.browserWeb.on('task-queued', (payload: any) => {
      this.emit('task-queued', payload);
    });
    this.browserWeb.on('task-started', (payload: any) => {
      this.status = 'executing';
      this.currentTask = payload.task || this.currentTask;
      this.currentStep = 0;
      this.emit('task-started', payload);
    });
    this.browserWeb.on('step', (payload: any) => {
      this.currentStep = payload.step || this.currentStep;
      this.emit('step', payload);
    });
    this.browserWeb.on('step-result', (payload: any) => {
      this.emit('step-result', payload);
    });
    this.browserWeb.on('task-completed', (payload: any) => {
      this.restoreLegacyStatusAfterExternalBackendEvent();
      this.emit('task-completed', payload);
    });
    this.browserWeb.on('task-failed', (payload: any) => {
      this.restoreLegacyStatusAfterExternalBackendEvent();
      this.emit('task-failed', payload);
    });
  }

  private registerWindowsUIAEventForwarding(): void {
    this.windowsUIA.on('task-queued', (payload: any) => {
      this.emit('task-queued', payload);
    });
    this.windowsUIA.on('task-started', (payload: any) => {
      this.status = 'executing';
      this.currentTask = payload.task || this.currentTask;
      this.currentStep = 0;
      this.emit('task-started', payload);
    });
    this.windowsUIA.on('step', (payload: any) => {
      this.currentStep = payload.step || this.currentStep;
      this.emit('step', payload);
    });
    this.windowsUIA.on('step-result', (payload: any) => {
      this.emit('step-result', payload);
    });
    this.windowsUIA.on('task-completed', (payload: any) => {
      this.restoreLegacyStatusAfterExternalBackendEvent();
      this.emit('task-completed', payload);
    });
    this.windowsUIA.on('task-failed', (payload: any) => {
      this.restoreLegacyStatusAfterExternalBackendEvent();
      this.emit('task-failed', payload);
    });
  }

  private shouldUseBrowserBackend(task: string, options?: DesktopTaskExecutionOptions): boolean {
    if (options?.backend === 'browser') return true;
    if (options?.backend === 'uia') return false;
    if (options?.backend === 'desktop') return false;

    const lower = task.toLowerCase();
    return /https?:\/\/|www\.|gmail|google calendar|calendar\.google|mail\.google|drive\.google|docs\.google|sheets\.google|slides\.google|linkedin|notion|salesforce|hubspot|chatgpt|chat gpt|chat\.openai\.com|sitio web|pagina web|pagina de|navegador|browser|chrome|edge|formulario web|portal web/.test(lower);
  }

  private shouldUseWindowsUIABackend(task: string, options?: DesktopTaskExecutionOptions): boolean {
    if (options?.backend === 'uia') return true;
    if (options?.backend === 'browser' || options?.backend === 'desktop') return false;
    if (this.shouldUseBrowserBackend(task, options)) return false;

    const lower = task.toLowerCase();
    return /explorador de archivos|file explorer|explorer|bloc de notas|notepad|calculadora|calculator|paint|word|excel|powerpoint|outlook|configuracion de windows|windows settings|panel de control|control panel|administrador de tareas|task manager|guardar como|save as|abrir archivo|open file|selector de archivos|file picker|dialogo de archivo|file dialog|office|winrar|7-zip|propiedades de carpeta|menu inicio|start menu/.test(lower);
  }

  private async executeBrowserTask(task: string, options?: DesktopTaskExecutionOptions): Promise<string> {
    console.log(`[DesktopAgent] Enrutando tarea a backend browser_web: "${task}"`);
    return this.browserWeb.executeTask(task, {
      maxSteps: options?.maxSteps,
      startUrl: options?.startUrl,
      profileId: options?.browserProfile,
      isolated: options?.browserIsolated,
      resetProfile: options?.resetBrowserProfile,
    });
  }

  private async executeWindowsUIATask(task: string, options?: DesktopTaskExecutionOptions): Promise<string> {
    console.log(`[DesktopAgent] Enrutando tarea a backend windows_uia: "${task}"`);
    try {
      const result = await this.windowsUIA.executeTask(task, options);
      const runResult = this.windowsUIA.getLastRunResult();
      if (runResult && runResult.status !== 'completed' && runResult.fallbackRecommended) {
        return this.runDesktopFallbackFromUIA(task, options, runResult);
      }
      return result;
    } catch (err: any) {
      const runResult = this.windowsUIA.getLastRunResult();
      if (runResult?.fallbackRecommended) {
        return this.runDesktopFallbackFromUIA(task, options, runResult);
      }
      throw err;
    }
  }

  // ─── Main Task Execution ──────────────────────────────────────────

  async executeTask(task: string, options?: DesktopTaskExecutionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada.');
    }
    if (this.shouldUseBrowserBackend(task, options)) {
      return this.executeBrowserTask(task, options);
    }
    if (this.shouldUseWindowsUIABackend(task, options)) {
      return this.executeWindowsUIATask(task, options);
    }

    // Multi-agent: si ya hay agentes activos, encolar si estamos al límite
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

    const agentTask: AgentTask = {
      id: taskId,
      task,
      status: 'executing',
      currentStep: 0,
      maxSteps,
      plan: null,
      actionHistory: [],
      recovery: { consecutiveFailures: 0, sameScreenCount: 0, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 },
      abortController: taskAbort,
      startedAt: Date.now(),
    };
    this.activeTasks.set(taskId, agentTask);

    // Also update legacy single-task state for backward compatibility
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
      // Phase 1: Planning
      if (this.config.planningEnabled) {
        this.status = 'planning';
        const screenshot = await this.takeScreenshot();
        this.currentPlan = await this.createPlan(task, screenshot);
        this.emit('plan-created', this.currentPlan);
        console.log(`[DesktopAgent] Plan: ${this.currentPlan.subGoals.length} sub-objetivos, ~${this.currentPlan.estimatedSteps} pasos`);
      }

      // Phase 2: Execution loop with proactive recovery
      this.status = 'executing';

      for (this.currentStep = 0; this.currentStep < maxSteps; this.currentStep++) {
        agentTask.currentStep = this.currentStep;
        if (taskAbort.signal.aborted) {
          return 'Tarea cancelada por el usuario.';
        }

        // V2: Periodically summarize history for long tasks
        if (this.currentStep > 0 && this.currentStep % this.config.summarizeEveryNSteps === 0) {
          await this.summarizeHistory();
        }

        // V2: Check phase completion for hierarchical planning
        if (this.strategicPlan && this.currentStep > 0 && this.currentStep % 10 === 0) {
          await this.checkPhaseCompletion(task);
        }

        // Take screenshot with Set-of-Marks or grid
        const { screenshot } = await this.takeScreenshotWithMarks();
        const currentHash = this.quickHash(screenshot);

        // ─── Stuck Detection ──────────────────────────────────────
        if (currentHash === this.recovery.lastScreenHash) {
          this.recovery.sameScreenCount++;
        } else {
          this.recovery.sameScreenCount = 0;
          this.recovery.lastScreenHash = currentHash;
        }

        // If stuck (same screen N times), attempt proactive recovery
        if (this.recovery.sameScreenCount >= this.config.stuckDetectionThreshold) {
          console.warn(`[DesktopAgent] ⚠️ ATASCADO — pantalla sin cambios durante ${this.recovery.sameScreenCount} pasos`);
          this.emit('stuck-detected', { step: this.currentStep, sameScreenCount: this.recovery.sameScreenCount });

          if (this.config.replanOnStuck) {
            const recovered = await this.proactiveRecovery(task, screenshot, 'stuck');
            if (recovered) {
              this.recovery.sameScreenCount = 0;
              continue; // Re-enter loop with fresh screenshot
            }
          }
        }

        // ─── Vision Step ──────────────────────────────────────────
        let actionPayload: DesktopActionPayload;
        const useRecoveryContext = this.recovery.consecutiveFailures > 0;

        try {
          actionPayload = await this.visionStep(task, screenshot, false, useRecoveryContext);
        } catch (err: any) {
          console.error(`[DesktopAgent] Error de visión (paso ${this.currentStep + 1}):`, err.message);
          // Retry with fallback model
          try {
            await this.delay(2000);
            actionPayload = await this.visionStep(task, screenshot, true, useRecoveryContext);
          } catch {
            // Don't give up — try to recover
            this.recovery.consecutiveFailures++;
            if (this.recovery.consecutiveFailures >= this.config.maxConsecutiveFailures * 2) {
              return `Error persistente al analizar la pantalla después de ${this.currentStep} pasos.`;
            }
            continue;
          }
        }

        this.emit('step', { step: this.currentStep + 1, maxSteps, action: actionPayload });
        console.log(`[DesktopAgent] Paso ${this.currentStep + 1}: ${actionPayload.action} — ${actionPayload.message}`);

        // Check for completion
        if (actionPayload.action === 'done') {
          const msg = actionPayload.message || 'Tarea completada.';
          agentTask.result = msg;
          this.emit('task-completed', { message: msg, steps: this.currentStep + 1, recoveries: this.recovery.totalRecoveries, taskId });
          return msg;
        }

        // ─── Proactive: "fail" doesn't end immediately — try recovery first
        if (actionPayload.action === 'fail') {
          console.warn(`[DesktopAgent] [${taskId}] LLM reportó fallo: ${actionPayload.message}`);
          // Only truly fail if we've already tried recovery
          if (this.recovery.totalRecoveries > 0 && this.currentStep - this.recovery.lastRecoveryStep < 3) {
            const msg = `Error después de recuperación: ${actionPayload.message}`;
            agentTask.error = msg;
            this.emit('task-failed', { message: msg, steps: this.currentStep + 1, taskId });
            return msg;
          }
          // Try proactive recovery before giving up
          const recovered = await this.proactiveRecovery(task, screenshot, 'fail', actionPayload.message);
          if (recovered) continue;
          // If recovery also failed, then truly fail
          const msg = `Error: ${actionPayload.message}`;
          agentTask.error = msg;
          this.emit('task-failed', { message: msg, steps: this.currentStep + 1, taskId });
          return msg;
        }

        // ─── Execute action with retry ────────────────────────────
        actionPayload = this.refineActionCoordinates(actionPayload);
        const entry: ActionHistoryEntry = {
          step: this.currentStep,
          action: actionPayload,
          screenshotHash: currentHash,
          timestamp: Date.now(),
          success: true,
        };

        let actionSuccess = false;
        for (let retry = 0; retry <= this.config.maxRetryPerAction; retry++) {
          try {
            await this.executeAction(actionPayload);
            actionSuccess = true;
            break;
          } catch (err: any) {
            console.warn(`[DesktopAgent] Error ejecutando ${actionPayload.action} (intento ${retry + 1}):`, err.message);
            entry.errorMessage = err.message;
            if (retry < this.config.maxRetryPerAction) {
              await this.delay(300);
              // Slight coordinate adjustment on retry (±5px jitter)
              if (actionPayload.x !== undefined) {
                actionPayload = { ...actionPayload, x: actionPayload.x + (retry % 2 === 0 ? 5 : -5) };
              }
            }
          }
        }

        entry.success = actionSuccess;

        // V2: Post-action verification — did the screen actually change?
        if (actionSuccess && this.config.verificationEnabled) {
          const expectChange = ['click', 'double_click', 'right_click', 'type', 'key', 'drag', 'click_element', 'type_in_element'].includes(actionPayload.action);
          if (expectChange) {
            try {
              const postScreenshot = await this.takeScreenshotRaw();
              const postHash = this.quickHash(postScreenshot);
              if (postHash === currentHash) {
                entry.verificationFailed = true;
                console.warn(`[DesktopAgent] ⚠️ Verificación: pantalla no cambió después de ${actionPayload.action}`);
                this.recovery.consecutiveFailures++;
              }
            } catch (err: any) { console.warn(`[DesktopAgent] Verificación post-acción falló:`, err.message); }
          }
        }

        this.actionHistory.push(entry);

        // ─── Track consecutive failures for proactive recovery ────
        if (!actionSuccess || entry.verificationFailed) {
          this.recovery.consecutiveFailures++;
          if (this.recovery.consecutiveFailures >= this.config.maxConsecutiveFailures) {
            console.warn(`[DesktopAgent] ⚠️ ${this.recovery.consecutiveFailures} fallos consecutivos — activando recuperación proactiva`);
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

        // Update plan sub-goal progress
        if (this.currentPlan && actionPayload.subGoal) {
          const idx = this.currentPlan.subGoals.findIndex(
            g => g.toLowerCase().includes(actionPayload.subGoal!.toLowerCase()),
          );
          if (idx >= 0 && idx > this.currentPlan.currentSubGoalIndex) {
            this.currentPlan.currentSubGoalIndex = idx;
          }
        }

        // Smart delay based on action type
        await this.smartDelay(actionPayload);
      }

      const lastMsg = this.actionHistory[this.actionHistory.length - 1]?.action.message || '';
      const resultMsg = `Completé ${maxSteps} pasos de uso de computadora. ${lastMsg}`;
      agentTask.result = resultMsg;
      return resultMsg;

    } catch (err: any) {
      const errorMsg = `Error en paso ${this.currentStep}: ${err.message}`;
      console.error(`[DesktopAgent] ❌ FATAL [${taskId}]:`, err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
      agentTask.error = errorMsg;
      this.emit('task-failed', { message: errorMsg, steps: this.currentStep, taskId, error: err.message });
      throw err; // Re-throw so WhatsApp handler can catch it
    } finally {
      agentTask.status = 'idle';
      agentTask.completedAt = Date.now();
      this.activeTasks.delete(taskId);

      // Update legacy state
      if (this.activeTasks.size === 0) {
        this.status = 'idle';
        this.currentTask = null;
        this.abortController = null;
      } else {
        // Set legacy state to the first remaining active task
        const next = this.activeTasks.values().next().value;
        if (next) {
          this.status = next.status;
          this.currentTask = next.task;
          this.abortController = next.abortController;
        }
      }

      // Process any queued tasks
      this.processQueue();
    }
  }

  private async runDesktopFallbackFromUIA(
    task: string,
    options: DesktopTaskExecutionOptions | undefined,
    runResult: {
      message: string;
      failureCategory: string;
      verification: string | null;
      reportPath: string | null;
      tracePath: string | null;
    },
  ): Promise<string> {
    const fallbackTask = this.buildDesktopFallbackTask(task, runResult);
    console.warn(`[DesktopAgent] windows_uia fallo (${runResult.failureCategory}); fallback automatico a desktop_visual.`);
    this.emit('task-fallback', {
      fromBackend: 'windows_uia',
      toBackend: 'desktop_visual',
      reason: runResult.message,
      failureCategory: runResult.failureCategory,
      reportPath: runResult.reportPath || null,
      tracePath: runResult.tracePath || null,
    });
    const fallbackResult = await this.executeTask(fallbackTask, {
      ...options,
      backend: 'desktop',
    });
    return `windows_uia fallo y se activo fallback desktop_visual.\nMotivo UIA: ${runResult.message}\nResultado fallback: ${fallbackResult}`;
  }

  private buildDesktopFallbackTask(
    originalTask: string,
    runResult: {
      message: string;
      failureCategory: string;
      verification: string | null;
      reportPath: string | null;
      tracePath: string | null;
    },
  ): string {
    return `${originalTask}

Contexto adicional del intento previo con windows_uia:
- Falla detectada: ${runResult.message}
- Categoria: ${runResult.failureCategory}
- Ultima verificacion: ${runResult.verification || 'sin detalle'}
- Reporte UIA: ${runResult.reportPath || 'sin reporte'}
- Traza UIA: ${runResult.tracePath || 'sin traza'}

Continua desde el estado ACTUAL de la pantalla usando vision desktop. No reinicies la tarea desde cero salvo que sea imprescindible.`;
  }

  // ─── Proactive Recovery System ────────────────────────────────────

  /**
   * Activado cuando el agente se atasca, falla repetidamente, o el LLM reporta "fail".
   * En vez de terminar, analiza la situación y adapta la estrategia.
   *
   * Strategies:
   * 1. Re-analyze: Tomar screenshot fresco y pedir nueva perspectiva con modelo PRO
   * 2. Dismiss dialog: Detectar diálogos/popups inesperados y cerrarlos
   * 3. Re-plan: Generar nuevo plan desde el estado actual
   * 4. Alternative approach: Pedir al LLM un enfoque completamente diferente
   */
  private async proactiveRecovery(
    task: string, screenshotBase64: string, reason: 'stuck' | 'fail' | 'failures', failMessage?: string,
  ): Promise<boolean> {
    this.status = 'recovering';
    this.recovery.totalRecoveries++;
    this.recovery.lastRecoveryStep = this.currentStep;

    console.log(`[DesktopAgent] 🔄 Recuperación proactiva #${this.recovery.totalRecoveries} — razón: ${reason}`);
    this.emit('recovery-started', { reason, step: this.currentStep, totalRecoveries: this.recovery.totalRecoveries });

    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: this.config.proactiveModel });

      const recentHistory = this.actionHistory.slice(-5).map(h =>
        `  ${h.action.action}${h.action.x ? ` (${h.action.x},${h.action.y})` : ''} — ${h.success ? '✓' : '✗ ' + (h.errorMessage || '')} ${h.action.message}`,
      ).join('\n');

      const reasonDesc = reason === 'stuck'
        ? `La pantalla no ha cambiado en ${this.recovery.sameScreenCount} pasos consecutivos. El agente está ATASCADO.`
        : reason === 'failures'
          ? `Las últimas ${this.recovery.consecutiveFailures} acciones FALLARON consecutivamente.`
          : `El análisis determinó que la tarea falló: "${failMessage}"`;

      const prompt = `MODO RECUPERACIÓN PROACTIVA.

TAREA ORIGINAL: ${task}
${this.currentPlan ? `PLAN ACTUAL: ${this.currentPlan.subGoals.map((g, i) => `${i === this.currentPlan!.currentSubGoalIndex ? '>>> ' : ''}${g}`).join(' | ')}` : ''}

PROBLEMA: ${reasonDesc}

HISTORIAL RECIENTE:
${recentHistory || '(sin historial)'}

Paso actual: ${this.currentStep + 1}/${this.config.maxSteps}
Recuperaciones previas: ${this.recovery.totalRecoveries - 1}

ANALIZA la captura de pantalla actual y decide la MEJOR ESTRATEGIA DE RECUPERACIÓN.

IMPORTANTE: NO te rindas. Busca una solución alternativa. Posibles estrategias:
1. Si hay un diálogo/popup inesperado (cookie banner, error, confirmación, UAC), CIÉRRALO
2. Si el click anterior no funcionó, prueba en coordenadas ligeramente diferentes
3. Si la ventana esperada no apareció, intenta abrirla de otra forma
4. Si estás en la pantalla incorrecta, navega a la correcta
5. Si un campo de texto no respondió, haz click primero para enfocarlo
6. Si la app no responde, usa alt+tab o focus_window
7. Si todo lo anterior falla, propón un enfoque COMPLETAMENTE DIFERENTE

Responde SOLO con JSON:
{
  "strategy": "dismiss_dialog|retry_adjusted|navigate|refocus|alternative_approach|replan",
  "actions": [
    {"action": "...", "x": ..., "y": ..., "text": "...", "key": "...", "message": "..."}
  ],
  "newSubGoals": ["..."] (solo si strategy es "replan"),
  "reasoning": "explicación de por qué esta estrategia funcionará"
}`;

      const result = await model.generateContent([
        { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
        { text: prompt },
      ]);

      const parsed: any = this.parseVisionResponse(result.response.text());
      console.log(`[DesktopAgent] 🔄 Estrategia: ${parsed.strategy || 'unknown'} — ${parsed.reasoning || ''}`);
      this.emit('recovery-strategy', { strategy: parsed.strategy, reasoning: parsed.reasoning });

      // Execute recovery actions
      const recoveryActions: DesktopActionPayload[] = Array.isArray(parsed.actions) ? parsed.actions : [];
      for (const action of recoveryActions.slice(0, 5)) {
        if (this.abortController?.signal.aborted) return false;
        try {
          console.log(`[DesktopAgent] 🔄 Recovery action: ${action.action} — ${action.message || ''}`);
          await this.executeAction(action);
          this.actionHistory.push({
            step: this.currentStep,
            action,
            timestamp: Date.now(),
            success: true,
            wasRecovery: true,
          });
          await this.delay(500);
        } catch (err: any) {
          console.warn(`[DesktopAgent] Recovery action failed: ${err.message}`);
        }
      }

      // Re-plan if suggested
      if (parsed.strategy === 'replan' && Array.isArray(parsed.newSubGoals) && parsed.newSubGoals.length > 0) {
        if (this.currentPlan) {
          this.currentPlan.subGoals = parsed.newSubGoals;
          this.currentPlan.currentSubGoalIndex = 0;
          this.currentPlan.replannedCount++;
          this.emit('plan-updated', this.currentPlan);
          console.log(`[DesktopAgent] 🔄 Plan actualizado (replan #${this.currentPlan.replannedCount}): ${parsed.newSubGoals.length} nuevos sub-objetivos`);
        }
      }

      this.status = 'executing';
      return true; // Recovery attempted — continue the loop
    } catch (err: any) {
      console.error(`[DesktopAgent] Recovery falló:`, err.message);
      this.status = 'executing';
      return false;
    }
  }

  // ─── Continuous Observation Mode ──────────────────────────────────

  async startObservation(objective: string, reactionRules?: string): Promise<void> {
    if (this.observationInterval) this.stopObservation();
    if (!this.apiKey) throw new Error('API key de Gemini no configurada.');

    this.status = 'observing';
    this.calculateScreenScale();
    let lastHash = '';

    console.log(`[DesktopAgent] Modo observación: "${objective}"`);
    this.emit('observation-started', { objective });

    this.observationInterval = setInterval(async () => {
      if (this.observationRunning) return; // Skip if previous cycle still running
      this.observationRunning = true;

      try {
        const screenshot = await this.takeScreenshot();
        const hash = this.quickHash(screenshot);

        // Only analyze when screen changes (saves tokens)
        if (hash === lastHash) { this.observationRunning = false; return; }
        lastHash = hash;

        const prompt = `MODO OBSERVACION CONTINUA.
Objetivo: ${objective}
${reactionRules ? `Reglas de reaccion:\n${reactionRules}` : ''}

Analiza la pantalla. Si necesitas actuar, responde con una accion JSON.
Si no necesitas actuar, responde: {"action": "wait", "message": "observando..."}

Formato JSON (sin markdown):
{
  "action": "click|type|key|scroll|done|wait|...",
  "x": number, "y": number,
  "text": "...", "key": "...",
  "message": "descripcion"
}`;

        const ai = this.getGenAI();
        const model = ai.getGenerativeModel({ model: this.config.model });
        const result = await model.generateContent([
          { inlineData: { mimeType: 'image/png', data: screenshot } },
          { text: prompt },
        ]);

        const action = this.parseVisionResponse(result.response.text());

        if (action.action !== 'wait') {
          console.log(`[DesktopAgent] Observación → ${action.action}: ${action.message}`);
          this.emit('observation-action', action);
          await this.executeAction(action);
        }
      } catch (err: any) {
        console.error('[DesktopAgent] Error en observación:', err.message);
      } finally {
        this.observationRunning = false;
      }
    }, this.config.continuousObservationInterval);
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

  // ─── Internal: Vision Step ────────────────────────────────────────

  private async visionStep(task: string, screenshotBase64: string, useFallback = false, recoveryContext = false): Promise<DesktopActionPayload> {
    const modelId = useFallback ? this.config.fallbackModel : this.config.model;
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: modelId });

    const prompt = this.buildVisionPrompt(task, recoveryContext);

    // V2: Include zoom image as second image if available
    const parts: any[] = [
      { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
    ];
    if (this.lastZoomImage) {
      parts.push({ inlineData: { mimeType: 'image/png', data: this.lastZoomImage } });
      this.lastZoomImage = null; // Consumed — will be regenerated if zoom action is used again
    }
    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    return this.parseVisionResponse(result.response.text());
  }

  private buildVisionPrompt(task: string, recoveryContext = false): string {
    const historyContext = this.getHistoryContext();

    // V2: Strategic plan context (phases) or legacy flat plan
    let planContext = '';
    if (this.strategicPlan) {
      const sp = this.strategicPlan;
      planContext = `\nPLAN ESTRATÉGICO (${sp.phases.length} fases):\n`;
      for (let i = 0; i < sp.phases.length; i++) {
        const phase = sp.phases[i];
        const marker = i === sp.currentPhaseIndex ? '>>>' : phase.status === 'completed' ? ' ✓ ' : '   ';
        planContext += `${marker} Fase ${i + 1}: ${phase.name} [${phase.status}]\n`;
        if (i === sp.currentPhaseIndex) {
          planContext += `    Criterio de éxito: ${phase.successCriteria}\n`;
          planContext += phase.subGoals.map((g, j) =>
            `    ${j === phase.currentSubGoalIndex ? '→ ' : '  '}${j + 1}. ${g}`,
          ).join('\n') + '\n';
        }
      }
    } else if (this.currentPlan) {
      planContext = `\nPLAN (sub-objetivos):\n${this.currentPlan.subGoals.map((g, i) =>
        `${i === this.currentPlan!.currentSubGoalIndex ? '>>> ' : '    '}${i + 1}. ${g}`,
      ).join('\n')}\n`;
    }

    const recoveryNote = recoveryContext
      ? `\n⚠️ ATENCIÓN: Las últimas acciones fallaron (${this.recovery.consecutiveFailures} fallos). ANALIZA con cuidado y considera un enfoque diferente. Si ves un popup o diálogo inesperado, ciérralo primero.\n`
      : '';

    // V2: History summaries for long tasks
    const summariesContext = this.historySummaries.length > 0
      ? `\nRESÚMENES DE PROGRESO:\n${this.historySummaries.map(s => `[Pasos ${s.fromStep + 1}-${s.toStep + 1}]: ${s.summary}`).join('\n')}\n`
      : '';

    // V2: Zoom context if available
    const zoomNote = this.lastZoomImage
      ? `\nTienes disponible una imagen ZOOM de la última región inspeccionada (se envía como segunda imagen).\n`
      : '';

    // V2: Set-of-Marks context
    const somContext = this.captureMode === 'som' && this.currentUIElements.length > 0
      ? `\nMODO SET-OF-MARKS: Los elementos interactivos están marcados con números [1], [2], [3]... en la imagen.
Elementos detectados:
${this.currentUIElements.slice(0, 20).map(e => `  [${e.id}] ${e.controlType}: "${e.name}"`).join('\n')}
Puedes usar "click_element" con "elementId" para click PRECISO en un elemento marcado.
Puedes usar "type_in_element" con "elementId" y "text" para escribir en un campo marcado.
PREFIERE click_element/type_in_element sobre coordenadas cuando haya marcadores.\n`
      : '';

    // Determine actual screenshot dimensions for the prompt
    const imgW = this.lastActualScreenshotWidth || this.config.screenshotWidth;
    const imgH = this.lastActualScreenshotHeight || this.config.screenshotHeight;
    const monitorContext = this.describeScreenshotMonitorContext();

    return `TAREA: ${task}
${planContext}${recoveryNote}${summariesContext}${zoomNote}${somContext}${monitorContext}
Paso ${this.currentStep + 1} de maximo ${this.config.maxSteps}.
${historyContext ? `\nHISTORIAL RECIENTE:\n${historyContext}\n` : ''}
ANALIZA LA CAPTURA DE PANTALLA con cuidado antes de actuar.
Las coordenadas estan en el espacio de la imagen (${imgW}x${imgH}).
${this.config.gridEnabled ? `La imagen tiene una grilla roja con coordenadas cada ${this.config.gridStep}px.` : ''}

REGLAS CRÍTICAS:
1. MIRA LA PANTALLA PRIMERO: Antes de actuar, describe en "message" QUÉ VES en la pantalla actual.
2. NO RE-ABRAS apps que ya están abiertas. Si ves la Calculadora ya abierta, NO vuelvas a buscarla.
2.1. LA CAPTURA PUEDE INCLUIR VARIOS MONITORES: revisa toda la imagen antes de abrir o buscar otra instancia. Si la app ya está visible en otra pantalla, usa focus_window o interactúa con ella.
3. ANTES DE ESCRIBIR (type): Asegúrate de que la ventana correcta tiene el foco. Si no estás seguro, haz CLICK en la ventana primero.
4. UN NÚMERO A LA VEZ en calculadoras: Para escribir "389", usa type con "389". Para sumar, haz CLICK en el botón "+", no uses key.
5. VERIFICACIÓN: Si el historial muestra ⚠️VERIFICACIÓN_FALLÓ, la acción anterior NO tuvo efecto. Intenta diferente: haz click en la ventana para dar foco, o usa coordenadas distintas.
6. SI LA APP YA ESTÁ ABIERTA pero minimizada: usa focus_window con windowTitle, NO abras otra instancia.
7. COORDENADAS PRECISAS: Haz click en el CENTRO del botón, no en el borde. Para botones de calculadora, apunta al centro exacto.

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "action": "click|double_click|right_click|drag|mouse_down|mouse_up|mouse_move|type|key|scroll|wait|wait_for_change|wait_for_window|focus_window|minimize_window|maximize_window|restore_window|close_window|zoom|click_element|type_in_element|done|fail",
  "x": number, "y": number,
  "x2": number, "y2": number,
  "text": "texto a escribir",
  "key": "enter|tab|escape|ctrl+s|ctrl+a|ctrl+c|ctrl+v|ctrl+z|alt+f4|alt+tab|win|...",
  "direction": "up|down",
  "amount": number,
  "windowTitle": "titulo parcial",
  "zoomX": number, "zoomY": number, "zoomRadius": number,
  "elementId": number,
  "message": "descripcion de QUÉ VEO y QUÉ HAGO",
  "subGoal": "sub-objetivo actual",
  "confidence": 0.0-1.0
}

ACCIONES DISPONIBLES:
- click/double_click/right_click: Mouse en coordenadas (x,y). Haz click en el CENTRO del elemento.
- drag: Arrastrar de (x,y) a (x2,y2)
- type: Escribir texto. ⚠️ REQUIERE que la ventana correcta tenga foco. Si no, haz click en ella primero.
- key: Tecla o combo (enter, tab, escape, ctrl+s, alt+f4, alt+tab, win, etc.)
- scroll: Scroll con "direction" y "amount"
- focus_window: Traer ventana al frente. Usa "windowTitle" con parte del título. MEJOR que re-abrir una app.
- minimize_window/maximize_window/restore_window/close_window: Gestión de ventanas
- zoom: Inspeccionar región ampliada. Usa zoomX, zoomY, zoomRadius. Úsalo antes de clickear elementos pequeños.
- click_element: Click PRECISO en marcador [N] (solo modo Set-of-Marks)
- type_in_element: Click + escribir en campo marcado [N]
- done: Tarea completada — resultado en "message"
- fail: Tarea imposible después de intentar varias estrategias

Si la tarea ya esta completada, usa "done".`;
  }

  private getHistoryContext(): string {
    // V2: Use sliding window — only last maxRawHistorySteps
    const windowSize = this.config.maxRawHistorySteps || this.config.memoryWindowSize;
    const recent = this.actionHistory.slice(-windowSize);
    if (recent.length === 0) return '';
    return recent.map(h => {
      const vFail = h.verificationFailed ? ' ⚠️VERIFICACIÓN_FALLÓ' : '';
      return `  Paso ${h.step + 1}: ${h.action.action}${h.action.elementId ? ` [elem ${h.action.elementId}]` : ''}${h.action.x ? ` (${h.action.x},${h.action.y})` : ''}${h.action.text ? ` "${h.action.text}"` : ''}${h.action.key ? ` [${h.action.key}]` : ''} — ${h.success ? '✓' : '✗'}${vFail} ${h.action.message}`;
    }).join('\n');
  }

  private parseVisionResponse(text: string): DesktopActionPayload {
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON from the response
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error(`No se pudo parsear la respuesta del LLM: ${jsonStr.slice(0, 200)}`);
    }
  }

  // ─── Internal: Planning ───────────────────────────────────────────

  private async createPlan(task: string, screenshotBase64: string): Promise<TaskPlan> {
    const ai = this.getGenAI();

    // V2: Use hierarchical planning with PRO model for complex tasks
    if (this.config.hierarchicalPlanningEnabled) {
      try {
        const proModel = ai.getGenerativeModel({ model: this.config.proactiveModel });
        const stratPrompt = `Analiza la pantalla actual y la tarea solicitada.
TAREA: ${task}

Descompone la tarea en FASES de alto nivel. Cada fase es un objetivo independiente
con criterios de éxito claros (lo que debe verse en pantalla cuando la fase esté completa).

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "goal": "objetivo principal",
  "phases": [
    {
      "name": "nombre corto de la fase",
      "description": "descripcion detallada",
      "successCriteria": "qué debe verse en pantalla cuando esta fase esté completa",
      "subGoals": ["paso 1", "paso 2", ...],
      "estimatedSteps": number
    }
  ],
  "totalEstimatedSteps": number
}`;

        const result = await proModel.generateContent([
          { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
          { text: stratPrompt },
        ]);
        const parsed: any = this.parseVisionResponse(result.response.text());

        if (parsed.phases && parsed.phases.length > 0) {
          this.strategicPlan = {
            goal: parsed.goal || task,
            phases: parsed.phases.map((p: any) => ({
              name: p.name || 'Fase',
              description: p.description || '',
              successCriteria: p.successCriteria || '',
              subGoals: p.subGoals || [],
              currentSubGoalIndex: 0,
              estimatedSteps: p.estimatedSteps || 15,
              status: 'pending' as const,
            })),
            currentPhaseIndex: 0,
            totalEstimatedSteps: parsed.totalEstimatedSteps || 50,
          };
          this.strategicPlan.phases[0].status = 'in_progress';
          this.strategicPlan.phases[0].startStep = 0;
          console.log(`[DesktopAgent] Plan estratégico: ${this.strategicPlan.phases.length} fases, ~${this.strategicPlan.totalEstimatedSteps} pasos`);
          this.emit('strategic-plan-created', this.strategicPlan);

          // Return legacy TaskPlan from first phase for backward compat
          const firstPhase = this.strategicPlan.phases[0];
          return {
            goal: parsed.goal || task,
            subGoals: firstPhase.subGoals,
            currentSubGoalIndex: 0,
            estimatedSteps: this.strategicPlan.totalEstimatedSteps,
            replannedCount: 0,
          };
        }
      } catch (err: any) {
        console.warn(`[DesktopAgent] Hierarchical planning failed, falling back to flat: ${err.message}`);
      }
    }

    // Flat planning fallback
    const model = ai.getGenerativeModel({ model: this.config.model });
    const prompt = `Analiza la pantalla actual y la tarea solicitada.
TAREA: ${task}

Descompone la tarea en sub-objetivos claros y ordenados.
Cada sub-objetivo debe ser una accion concreta y verificable.

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "goal": "objetivo principal",
  "subGoals": ["paso 1: ...", "paso 2: ...", ...],
  "estimatedSteps": number
}`;

    try {
      const result = await model.generateContent([
        { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
        { text: prompt },
      ]);
      const parsed: any = this.parseVisionResponse(result.response.text());
      return {
        goal: parsed.goal || task,
        subGoals: parsed.subGoals || [task],
        currentSubGoalIndex: 0,
        estimatedSteps: parsed.estimatedSteps || 20,
        replannedCount: 0,
      };
    } catch {
      return { goal: task, subGoals: [task], currentSubGoalIndex: 0, estimatedSteps: 30, replannedCount: 0 };
    }
  }

  // V2: Summarize history every N steps to keep context manageable
  private async summarizeHistory(): Promise<void> {
    const fromStep = this.historySummaries.length > 0
      ? this.historySummaries[this.historySummaries.length - 1].toStep + 1
      : 0;
    const toStep = this.currentStep - 1;
    if (toStep <= fromStep) return;

    const stepsToSummarize = this.actionHistory.filter(h => h.step >= fromStep && h.step <= toStep);
    if (stepsToSummarize.length === 0) return;

    const stepsText = stepsToSummarize.map(h =>
      `${h.action.action}${h.action.x ? ` (${h.action.x},${h.action.y})` : ''} — ${h.success ? '✓' : '✗'} ${h.action.message}`,
    ).join('\n');

    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: this.config.model });
      const result = await model.generateContent(
        `Resume estas acciones de control de escritorio en 2-3 oraciones cortas en español. ¿Qué se logró? ¿Qué falló?\n\nAcciones (pasos ${fromStep + 1} a ${toStep + 1}):\n${stepsText}\n\nResponde SOLO con el resumen, sin JSON.`,
      );
      const summary = result.response.text().trim();
      this.historySummaries.push({ fromStep, toStep, summary });
      console.log(`[DesktopAgent] Resumen pasos ${fromStep + 1}-${toStep + 1}: ${summary.slice(0, 100)}...`);
    } catch (err: any) {
      console.warn(`[DesktopAgent] Resumen de historial falló:`, err.message);
      this.historySummaries.push({ fromStep, toStep, summary: `Pasos ${fromStep + 1}-${toStep + 1}: ${stepsToSummarize.length} acciones ejecutadas.` });
    }
  }

  // V2: Check if the current phase's success criteria are met
  private async checkPhaseCompletion(_task: string): Promise<void> {
    if (!this.strategicPlan) return;
    const phase = this.strategicPlan.phases[this.strategicPlan.currentPhaseIndex];
    if (!phase || phase.status !== 'in_progress') return;

    try {
      const screenshot = await this.takeScreenshotRaw();
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: this.config.proactiveModel });
      const result = await model.generateContent([
        { inlineData: { mimeType: 'image/png', data: screenshot } },
        { text: `VERIFICACIÓN DE FASE.\n\nFase actual: "${phase.name}"\nCriterio de éxito: "${phase.successCriteria}"\n\n¿La pantalla actual muestra que el criterio de éxito se cumplió? Responde SOLO con JSON: {"completed": true/false, "reason": "..."}` },
      ]);
      const parsed: any = this.parseVisionResponse(result.response.text());

      if (parsed.completed) {
        phase.status = 'completed';
        phase.endStep = this.currentStep;
        console.log(`[DesktopAgent] ✅ Fase completada: "${phase.name}" — ${parsed.reason || ''}`);
        this.emit('phase-completed', {
          phase,
          phaseIndex: this.strategicPlan.currentPhaseIndex,
          totalPhases: this.strategicPlan.phases.length,
          nextPhase: this.strategicPlan.phases[this.strategicPlan.currentPhaseIndex + 1] || null,
        });

        // Advance to next phase
        if (this.strategicPlan.currentPhaseIndex < this.strategicPlan.phases.length - 1) {
          this.strategicPlan.currentPhaseIndex++;
          const next = this.strategicPlan.phases[this.strategicPlan.currentPhaseIndex];
          next.status = 'in_progress';
          next.startStep = this.currentStep;
          // Update legacy plan with next phase's sub-goals
          if (this.currentPlan) {
            this.currentPlan.subGoals = next.subGoals;
            this.currentPlan.currentSubGoalIndex = 0;
          }
        }
      }
    } catch { /* phase check is best-effort */ }
  }

  // ─── Internal: Action Execution ───────────────────────────────────

  private async executeAction(action: DesktopActionPayload): Promise<void> {
    action = this.refineActionCoordinates(action);

    if (action.action !== 'done' && action.action !== 'fail') {
      this.logActionCoordinateResolution(action);
      this.assertActionTargetsVisibleContent(action);
    }

    switch (action.action) {
      case 'click':
        await this.mouseClick(action.x!, action.y!);
        break;
      case 'double_click':
        await this.mouseDoubleClick(action.x!, action.y!);
        break;
      case 'right_click':
        await this.mouseRightClick(action.x!, action.y!);
        break;
      case 'drag':
        await this.mouseDrag(action.x!, action.y!, action.x2!, action.y2!);
        break;
      case 'mouse_down':
        await this.mouseDown(action.x!, action.y!);
        break;
      case 'mouse_up':
        await this.mouseUp(action.x, action.y);
        break;
      case 'mouse_move':
        await this.mouseMove(action.x!, action.y!);
        break;
      case 'type':
        // If coordinates provided, click there first to ensure focus
        if (action.x !== undefined && action.y !== undefined) {
          await this.mouseClick(action.x, action.y);
          await this.delay(150);
        }
        await this.keyboardType(action.text!);
        break;
      case 'key':
        await this.keyboardKey(action.key!);
        break;
      case 'scroll':
        await this.mouseScroll(action.direction || 'down', action.amount || 3);
        break;
      case 'focus_window':
        await this.focusWindow(action.windowTitle || '');
        break;
      case 'minimize_window':
        await this.minimizeWindow(action.windowTitle || '');
        break;
      case 'maximize_window':
        await this.maximizeWindow(action.windowTitle || '');
        break;
      case 'restore_window':
        await this.restoreWindow(action.windowTitle || '');
        break;
      case 'close_window':
        await this.closeWindow(action.windowTitle || '');
        break;
      case 'wait':
        await this.delay((action.amount || 2) * 1000);
        break;
      case 'wait_for_change':
        await this.waitForScreenChange((action.amount || 8) * 1000);
        break;
      case 'wait_for_window':
        await this.waitForWindow(action.windowTitle || '', (action.amount || 10) * 1000);
        break;
      // V2 actions
      case 'zoom': {
        const zx = action.zoomX ?? action.x ?? this.config.screenshotWidth / 2;
        const zy = action.zoomY ?? action.y ?? this.config.screenshotHeight / 2;
        const zr = action.zoomRadius ?? 150;
        this.lastZoomImage = await this.takeZoomScreenshot(zx, zy, zr);
        break;
      }
      case 'click_element': {
        const el = this.currentUIElements.find(e => e.id === action.elementId);
        if (el) {
          const cx = el.boundingRect.x + el.boundingRect.width / 2;
          const cy = el.boundingRect.y + el.boundingRect.height / 2;
          const screenshotPoint = this.mapDesktopPointToScreenshotPoint(cx, cy);
          if (screenshotPoint) {
            await this.mouseClick(screenshotPoint.x, screenshotPoint.y);
          }
        } else if (action.x !== undefined && action.y !== undefined) {
          await this.mouseClick(action.x, action.y); // Fallback to coordinates
        }
        break;
      }
      case 'type_in_element': {
        const tel = this.currentUIElements.find(e => e.id === action.elementId);
        if (tel) {
          const tcx = tel.boundingRect.x + tel.boundingRect.width / 2;
          const tcy = tel.boundingRect.y + tel.boundingRect.height / 2;
          const screenshotPoint = this.mapDesktopPointToScreenshotPoint(tcx, tcy);
          if (screenshotPoint) {
            await this.mouseClick(screenshotPoint.x, screenshotPoint.y);
            await this.delay(150);
          }
        }
        if (action.text) await this.keyboardType(action.text);
        break;
      }
      // done/fail are handled in the main loop before executeAction
    }
  }

  private async smartDelay(action: DesktopActionPayload): Promise<void> {
    const clickActions = ['click', 'double_click', 'right_click', 'drag'];
    if (clickActions.includes(action.action)) {
      // After clicks, wait for screen to react (max 3s, returns early if changed)
      await this.waitForScreenChange(3000);
    } else if (action.action === 'type' || action.action === 'key') {
      await this.delay(this.config.defaultActionDelay);
    } else if (['focus_window', 'maximize_window', 'restore_window', 'minimize_window'].includes(action.action)) {
      await this.delay(500);
    }
    // wait, wait_for_change, wait_for_window already handle their own delays
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
