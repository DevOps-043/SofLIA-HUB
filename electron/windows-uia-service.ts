import { EventEmitter } from 'node:events';
import { exec as execCb } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { app as electronApp, screen as electronScreen } from 'electron';
import type { DesktopAgentService } from './desktop-agent-service';
import type { UIElement } from './desktop-agent-types';

const execAsync = promisify(execCb);

type WindowsUIAStatus = 'idle' | 'executing';
type WindowsUIAFailureCategory = 'none' | 'explicit_fail' | 'verification' | 'timeout' | 'no_elements' | 'no_window' | 'cancelled' | 'error';

interface WindowsUIATaskOptions {
  maxSteps?: number;
}

interface WindowsUIAQueueEntry {
  task: string;
  options?: WindowsUIATaskOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

interface WindowsUIAActionPayload {
  action: 'focus_window' | 'click_element' | 'type_in_element' | 'key' | 'scroll' | 'wait' | 'done' | 'fail';
  windowTitle?: string;
  elementId?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  expected?: string;
  message: string;
}

interface WindowsUIASnapshot {
  currentWindowTitle: string;
  currentProcess: string;
  windows: Array<{ title: string; process: string; pid: number }>;
  elements: UIElement[];
  screenshotBase64: string;
  signature: string;
}

interface WindowsUIAHistoryEntry {
  step: number;
  action: WindowsUIAActionPayload;
  success: boolean;
  windowTitle: string;
  error?: string;
  verification?: string;
}

interface WindowsUIAArtifacts {
  taskId: string;
  runDirectory: string;
  reportPath: string;
  tracePath: string;
  finalScreenshotPath: string;
}

interface WindowsUIAStatusSnapshot {
  status: WindowsUIAStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentWindowTitle: string | null;
  lastAction: string | null;
  lastVerification: string | null;
  lastTracePath: string | null;
  lastReportPath: string | null;
  lastScreenshotPath: string | null;
  queuedTasks: number;
}

interface WindowsUIARunResult {
  status: 'completed' | 'failed' | 'cancelled' | 'error';
  message: string;
  failureCategory: WindowsUIAFailureCategory;
  fallbackRecommended: boolean;
  verification: string | null;
  reportPath: string | null;
  tracePath: string | null;
  screenshotPath: string | null;
}

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash';

export class WindowsUIAService extends EventEmitter {
  private apiKey = '';
  private genAI: GoogleGenerativeAI | null = null;
  private status: WindowsUIAStatus = 'idle';
  private currentTask: string | null = null;
  private currentStep = 0;
  private currentMaxSteps = 0;
  private currentWindowTitle: string | null = null;
  private lastAction: string | null = null;
  private lastVerification: string | null = null;
  private lastTracePath: string | null = null;
  private lastReportPath: string | null = null;
  private lastScreenshotPath: string | null = null;
  private lastRunResult: WindowsUIARunResult | null = null;
  private abortController: AbortController | null = null;
  private queue: WindowsUIAQueueEntry[] = [];

  constructor(private readonly desktopAgent: DesktopAgentService) {
    super();
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
  }

  getStatus(): WindowsUIAStatusSnapshot {
    return {
      status: this.status,
      currentTask: this.currentTask,
      currentStep: this.currentStep,
      maxSteps: this.currentMaxSteps,
      currentWindowTitle: this.currentWindowTitle,
      lastAction: this.lastAction,
      lastVerification: this.lastVerification,
      lastTracePath: this.lastTracePath,
      lastReportPath: this.lastReportPath,
      lastScreenshotPath: this.lastScreenshotPath,
      queuedTasks: this.queue.length,
    };
  }

  getLastRunResult(): WindowsUIARunResult | null {
    return this.lastRunResult ? { ...this.lastRunResult } : null;
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
      queued?.reject(new Error('Tarea UIA cancelada antes de ejecutarse.'));
    }
  }

  async executeTask(task: string, options?: WindowsUIATaskOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada para WindowsUIAService.');
    }

    if (this.status !== 'idle') {
      return new Promise<string>((resolve, reject) => {
        this.queue.push({ task, options, resolve, reject });
        this.emit('task-queued', { task, queuePosition: this.queue.length, backend: 'windows_uia' });
      });
    }

    return this.executeTaskInternal(task, options);
  }

  private async executeTaskInternal(task: string, options?: WindowsUIATaskOptions): Promise<string> {
    const maxSteps = options?.maxSteps ?? 30;
    const artifacts = this.createArtifacts(task);
    const taskAbort = new AbortController();
    const startedAt = new Date().toISOString();
    const history: WindowsUIAHistoryEntry[] = [];
    let finalSnapshot: WindowsUIASnapshot | null = null;
    let finalMessage = '';
    let finalStatus: 'completed' | 'failed' | 'cancelled' | 'error' = 'failed';
    let finalFailureCategory: WindowsUIAFailureCategory = 'none';

    this.abortController = taskAbort;
    this.status = 'executing';
    this.currentTask = task;
    this.currentStep = 0;
    this.currentMaxSteps = maxSteps;
    this.lastAction = null;
    this.lastVerification = null;
    this.lastTracePath = artifacts.tracePath;
    this.lastReportPath = artifacts.reportPath;
    this.lastScreenshotPath = null;
    this.lastRunResult = null;

    this.emit('task-started', {
      task,
      maxSteps,
      backend: 'windows_uia',
      taskId: artifacts.taskId,
      runDirectory: artifacts.runDirectory,
      tracePath: artifacts.tracePath,
    });
    this.appendTrace(artifacts.tracePath, {
      type: 'start',
      timestamp: startedAt,
      task,
      backend: 'windows_uia',
      maxSteps,
      taskId: artifacts.taskId,
    });

    try {
      const windows = await this.desktopAgent.listWindows();
      const likelyWindow = this.findLikelyWindow(task, windows);
      if (likelyWindow) {
        await this.desktopAgent.focusWindow(likelyWindow.title).catch(() => {});
      }

      let snapshot = await this.collectSnapshot();
      finalSnapshot = snapshot;
      if (snapshot.windows.length === 0) {
        finalFailureCategory = 'no_window';
        throw new Error('No hay ventanas activas para operar con windows_uia.');
      }
      if (snapshot.elements.length === 0) {
        finalFailureCategory = 'no_elements';
        throw new Error('No se detectaron elementos UIA interactivos en la ventana activa.');
      }

      this.appendTrace(artifacts.tracePath, {
        type: 'snapshot',
        timestamp: new Date().toISOString(),
        phase: 'initial',
        snapshot: this.summarizeSnapshot(snapshot),
      });

      for (let step = 0; step < maxSteps; step++) {
        if (taskAbort.signal.aborted) {
          finalStatus = 'cancelled';
          finalFailureCategory = 'cancelled';
          finalMessage = 'Tarea cancelada por el usuario.';
          return finalMessage;
        }

        this.currentStep = step + 1;
        snapshot = await this.collectSnapshot();
        finalSnapshot = snapshot;
        this.currentWindowTitle = snapshot.currentWindowTitle;
        const action = await this.decideNextAction(task, snapshot, history);
        this.lastAction = action.message || action.action;
        this.emit('step', { step: step + 1, maxSteps, backend: 'windows_uia', action });

        if (action.action === 'done') {
          finalStatus = 'completed';
          finalFailureCategory = 'none';
          finalMessage = action.message || 'Tarea UIA completada.';
          this.emit('task-completed', { message: finalMessage, steps: step + 1, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
          return finalMessage;
        }

        if (action.action === 'fail') {
          finalStatus = 'failed';
          finalFailureCategory = 'explicit_fail';
          finalMessage = action.message || 'La tarea UIA no se pudo completar.';
          this.appendTrace(artifacts.tracePath, {
            type: 'step',
            timestamp: new Date().toISOString(),
            step: step + 1,
            action,
            success: false,
            verification: finalMessage,
            before: this.summarizeSnapshot(snapshot, action.elementId),
            after: null,
            fallbackRecommended: this.shouldRecommendVisualFallback('explicit_fail'),
          });
          this.emit('task-failed', { message: finalMessage, steps: step + 1, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
          return finalMessage;
        }

        let success = false;
        let errorMessage = '';
        let verificationMessage = '';
        let afterSnapshot: WindowsUIASnapshot | null = null;
        try {
          await this.executeAction(action, snapshot);
          afterSnapshot = await this.collectSnapshot();
          finalSnapshot = afterSnapshot;
          const verification = this.verifyActionOutcome(action, snapshot, afterSnapshot);
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

        history.push({
          step: step + 1,
          action,
          success,
          error: errorMessage || undefined,
          verification: verificationMessage || undefined,
          windowTitle: this.currentWindowTitle || '',
        });

        this.appendTrace(artifacts.tracePath, {
          type: 'step',
          timestamp: new Date().toISOString(),
          step: step + 1,
          action,
          success,
          verification: verificationMessage || null,
          error: errorMessage || null,
          before: this.summarizeSnapshot(snapshot, action.elementId),
          after: afterSnapshot ? this.summarizeSnapshot(afterSnapshot, action.elementId) : null,
        });

        this.emit('step-result', { step: step + 1, maxSteps, backend: 'windows_uia', success, verification: verificationMessage, action });

        if (!success && history.slice(-3).filter((entry) => !entry.success).length >= 3) {
          finalStatus = 'failed';
          finalFailureCategory = 'verification';
          finalMessage = `Fallo persistente en windows_uia: ${errorMessage || 'sin detalle'}`;
          this.emit('task-failed', { message: finalMessage, steps: step + 1, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
          return finalMessage;
        }
      }

      finalStatus = 'failed';
      finalFailureCategory = 'timeout';
      finalMessage = 'Se alcanzo el limite de pasos del backend windows_uia.';
      this.emit('task-failed', { message: finalMessage, steps: maxSteps, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
      return finalMessage;
    } catch (err: any) {
      finalStatus = 'error';
      if (finalFailureCategory === 'none') {
        finalFailureCategory = 'error';
      }
      finalMessage = err.message || 'Error en windows_uia';
      this.lastVerification = finalMessage;
      this.emit('task-failed', { message: finalMessage, steps: this.currentStep, backend: 'windows_uia', error: finalMessage, taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
      throw err;
    } finally {
      await this.finalizeArtifacts(
        artifacts,
        task,
        startedAt,
        new Date().toISOString(),
        finalStatus,
        finalMessage,
        finalFailureCategory,
        history,
        finalSnapshot,
      );
      this.status = 'idle';
      this.currentTask = null;
      this.currentStep = 0;
      this.currentMaxSteps = 0;
      this.abortController = null;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.status !== 'idle' || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (!next) return;
    this.executeTaskInternal(next.task, next.options).then(next.resolve).catch(next.reject);
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  private async collectSnapshot(): Promise<WindowsUIASnapshot> {
    const currentWindow = await this.getForegroundWindowInfo();
    const windows = await this.desktopAgent.listWindows().catch(() => []);
    const elements = await this.desktopAgent.getUIElements();
    const screenshotBase64 = await this.desktopAgent.takeScreenshot().catch(() => '');
    const signature = JSON.stringify({
      currentWindowTitle: currentWindow.title,
      currentProcess: currentWindow.process,
      windows: windows.slice(0, 8).map((window) => `${window.title}|${window.process}`),
      elements: elements.slice(0, 20).map((element) => `${element.id}|${element.controlType}|${element.name}|${element.automationId || ''}|${element.value || ''}`),
    });

    return {
      currentWindowTitle: currentWindow.title,
      currentProcess: currentWindow.process,
      windows,
      elements,
      screenshotBase64,
      signature,
    };
  }

  private async getForegroundWindowInfo(): Promise<{ title: string; process: string; pid: number }> {
    const { stdout } = await execAsync(`powershell -NoProfile -Command "
Add-Type -Name FgWin -Namespace W -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport(\\\"user32.dll\\\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, [ref] uint processId);'
$hwnd = [W.FgWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[void][W.FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$pid = [uint32]0
[void][W.FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
@{ title = $sb.ToString(); process = ($proc.ProcessName); pid = $pid } | ConvertTo-Json -Compress
"`, { timeout: 3000, windowsHide: true });

    const parsed = JSON.parse(stdout || '{}');
    return {
      title: parsed.title || '',
      process: parsed.process || '',
      pid: parsed.pid || 0,
    };
  }

  private findLikelyWindow(task: string, windows: Array<{ title: string; process: string; pid: number }>): { title: string; process: string; pid: number } | null {
    const normalizedTask = task.toLowerCase();
    let best: { title: string; process: string; pid: number } | null = null;
    let bestScore = 0;

    for (const window of windows) {
      const haystack = `${window.title} ${window.process}`.toLowerCase();
      let score = 0;
      if (normalizedTask.includes(window.title.toLowerCase()) || normalizedTask.includes(window.process.toLowerCase())) score += 3;
      for (const token of normalizedTask.split(/\s+/)) {
        if (token.length >= 4 && haystack.includes(token)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = window;
      }
    }

    return bestScore >= 2 ? best : null;
  }

  private async decideNextAction(task: string, snapshot: WindowsUIASnapshot, history: WindowsUIAHistoryEntry[]): Promise<WindowsUIAActionPayload> {
    const prompt = this.buildPrompt(task, snapshot, history);
    const ai = this.getGenAI();

    for (const modelId of [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]) {
      try {
        const model = ai.getGenerativeModel({ model: modelId });
        const parts: any[] = [];
        if (snapshot.screenshotBase64) {
          parts.push({ inlineData: { mimeType: 'image/png', data: snapshot.screenshotBase64 } });
        }
        parts.push({ text: prompt });
        const result = await model.generateContent(parts);
        return this.parseAction(result.response.text());
      } catch (err: any) {
        if (modelId === DEFAULT_FALLBACK_MODEL) throw err;
      }
    }

    throw new Error('No se pudo obtener una accion del modelo para windows_uia.');
  }

  private buildPrompt(task: string, snapshot: WindowsUIASnapshot, history: WindowsUIAHistoryEntry[]): string {
    const windowsText = snapshot.windows.slice(0, 12)
      .map((window) => `- ${window.title || '(sin titulo)'} | ${window.process} | pid=${window.pid}`)
      .join('\n');

    const elementsText = snapshot.elements.slice(0, 25)
      .map((element) => {
        const parts = [
          `[${element.id}]`,
          element.controlType,
          element.name && `name="${element.name}"`,
          element.automationId && `automationId="${element.automationId}"`,
          element.value && `value="${element.value}"`,
          `enabled=${element.isEnabled}`,
        ].filter(Boolean);
        return parts.join(' | ');
      })
      .join('\n');

    const historyText = history.slice(-6)
      .map((entry) => `Paso ${entry.step}: ${entry.action.action} - ${entry.success ? 'OK' : `ERROR: ${entry.error || 'sin detalle'}`} - ${entry.verification || ''}`)
      .join('\n');

    return `TAREA NATIVA WINDOWS: ${task}

VENTANA ACTIVA:
- titulo: ${snapshot.currentWindowTitle || '(sin titulo)'}
- proceso: ${snapshot.currentProcess || '(sin proceso)'}

VENTANAS DISPONIBLES:
${windowsText || '(sin ventanas)'}

ELEMENTOS UIA DE LA VENTANA ACTIVA:
${elementsText || '(sin elementos detectados)'}

HISTORIAL:
${historyText || '(sin historial)'}

REGLAS:
1. Prefiere focus_window si la ventana correcta no esta al frente.
2. Prefiere click_element y type_in_element con elementId.
3. Usa key solo para Enter, Tab, Escape o atajos concretos.
4. Si el objetivo ya esta cumplido, responde done.
5. Si una accion reciente no produjo cambio verificable, cambia de estrategia.
6. En expected describe un cambio observable en la ventana o en un valor UIA.

RESPONDE SOLO JSON valido:
{
  "action": "focus_window|click_element|type_in_element|key|scroll|wait|done|fail",
  "windowTitle": "titulo parcial",
  "elementId": 3,
  "text": "texto a escribir",
  "key": "enter|tab|escape|ctrl+s",
  "direction": "up|down",
  "amount": 1,
  "expected": "cambio esperado",
  "message": "que veo y que hago"
}`;
  }

  private parseAction(rawText: string): WindowsUIAActionPayload {
    const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`No se pudo parsear la respuesta windows_uia: ${jsonText.slice(0, 240)}`);
      parsed = JSON.parse(match[0]);
    }

    return {
      action: parsed.action,
      windowTitle: typeof parsed.windowTitle === 'string' ? parsed.windowTitle.trim() : undefined,
      elementId: typeof parsed.elementId === 'number' ? parsed.elementId : undefined,
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

  private async executeAction(action: WindowsUIAActionPayload, snapshot: WindowsUIASnapshot): Promise<void> {
    switch (action.action) {
      case 'focus_window':
        await this.desktopAgent.focusWindow(action.windowTitle || snapshot.currentWindowTitle);
        return;
      case 'click_element': {
        const point = this.resolveElementPoint(snapshot, action.elementId);
        if (!point) throw new Error(`No se encontro el elemento UIA ${action.elementId}.`);
        await this.desktopAgent.mouseClick(point.x, point.y);
        return;
      }
      case 'type_in_element': {
        const point = this.resolveElementPoint(snapshot, action.elementId);
        if (!point) throw new Error(`No se encontro el elemento UIA ${action.elementId}.`);
        await this.desktopAgent.mouseClick(point.x, point.y);
        await new Promise((resolve) => setTimeout(resolve, 150));
        await this.desktopAgent.keyboardType(action.text || '');
        return;
      }
      case 'key':
        await this.desktopAgent.keyboardKey(action.key || 'enter');
        return;
      case 'scroll':
        await this.desktopAgent.mouseScroll(action.direction || 'down', action.amount || 3);
        return;
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, Math.max(500, (action.amount || 1) * 1000)));
        return;
      default:
        throw new Error(`Accion no soportada por windows_uia: ${action.action}`);
    }
  }

  private resolveElementPoint(snapshot: WindowsUIASnapshot, elementId?: number): { x: number; y: number } | null {
    const element = snapshot.elements.find((candidate) => candidate.id === elementId);
    if (!element) return null;

    const primary = electronScreen.getPrimaryDisplay();
    const screenWidth = primary.size.width || 1920;
    const screenHeight = primary.size.height || 1080;
    const config = this.desktopAgent.getConfig();
    const centerX = element.boundingRect.x + (element.boundingRect.width / 2);
    const centerY = element.boundingRect.y + (element.boundingRect.height / 2);

    return {
      x: centerX / (screenWidth / config.screenshotWidth),
      y: centerY / (screenHeight / config.screenshotHeight),
    };
  }

  private verifyActionOutcome(action: WindowsUIAActionPayload, before: WindowsUIASnapshot, after: WindowsUIASnapshot): { success: boolean; message: string } {
    if (action.expected && this.expectedAppears(action.expected, after)) {
      return { success: true, message: `Cambio esperado detectado: ${action.expected}` };
    }

    if (action.action === 'focus_window') {
      if (action.windowTitle && after.currentWindowTitle.toLowerCase().includes(action.windowTitle.toLowerCase())) {
        return { success: true, message: `La ventana ${after.currentWindowTitle} esta activa.` };
      }
      if (before.currentWindowTitle !== after.currentWindowTitle) {
        return { success: true, message: `La ventana activa cambio a ${after.currentWindowTitle}.` };
      }
      return { success: false, message: 'No cambio la ventana activa despues del focus_window.' };
    }

    if (action.action === 'type_in_element') {
      const afterElement = after.elements.find((element) => element.id === action.elementId);
      const typedText = this.normalizeText(action.text || '');
      if (afterElement && typedText && this.normalizeText(afterElement.value || '').includes(typedText)) {
        return { success: true, message: `El valor UIA del elemento ${action.elementId} refleja el texto.` };
      }
    }

    if (before.signature !== after.signature || before.currentWindowTitle !== after.currentWindowTitle) {
      return { success: true, message: 'Se detecto un cambio UIA en la ventana activa.' };
    }

    return { success: false, message: 'No se detecto un cambio UIA verificable despues de la accion.' };
  }

  private expectedAppears(expected: string, snapshot: WindowsUIASnapshot): boolean {
    const needle = this.normalizeText(expected);
    if (!needle || needle.length < 3) return false;
    const haystack = this.normalizeText([
      snapshot.currentWindowTitle,
      snapshot.currentProcess,
      snapshot.windows.map((window) => `${window.title} ${window.process}`).join(' '),
      snapshot.elements.map((element) => `${element.name} ${element.automationId || ''} ${element.value || ''}`).join(' '),
    ].join(' '));
    return haystack.includes(needle);
  }

  private getArtifactsBaseDir(): string {
    try {
      return path.join(electronApp.getPath('userData'), 'computer-use', 'windows-uia');
    } catch {
      return path.join(process.cwd(), 'computer-use-artifacts', 'windows-uia');
    }
  }

  private createArtifacts(task: string): WindowsUIAArtifacts {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTask = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';
    const runDirectory = path.join(this.getArtifactsBaseDir(), `${stamp}-${safeTask}`);
    fs.mkdirSync(runDirectory, { recursive: true });
    const tracePath = path.join(runDirectory, 'trace.jsonl');
    fs.writeFileSync(tracePath, '', 'utf-8');
    return {
      taskId: `uia-${Date.now().toString(36)}`,
      runDirectory,
      reportPath: path.join(runDirectory, 'report.json'),
      tracePath,
      finalScreenshotPath: path.join(runDirectory, 'final.png'),
    };
  }

  private async finalizeArtifacts(
    artifacts: WindowsUIAArtifacts,
    task: string,
    startedAt: string,
    finishedAt: string,
    status: 'completed' | 'failed' | 'cancelled' | 'error',
    message: string,
    failureCategory: WindowsUIAFailureCategory,
    history: WindowsUIAHistoryEntry[],
    finalSnapshot: WindowsUIASnapshot | null,
  ): Promise<void> {
    if (finalSnapshot?.screenshotBase64) {
      try {
        fs.writeFileSync(artifacts.finalScreenshotPath, Buffer.from(finalSnapshot.screenshotBase64, 'base64'));
        this.lastScreenshotPath = artifacts.finalScreenshotPath;
      } catch {
        this.lastScreenshotPath = null;
      }
    }

    const fallbackRecommended = this.shouldRecommendVisualFallback(failureCategory);
    this.appendTrace(artifacts.tracePath, {
      type: 'final',
      timestamp: finishedAt,
      status,
      message,
      failureCategory,
      fallbackRecommended,
      currentWindowTitle: finalSnapshot?.currentWindowTitle || this.currentWindowTitle,
      currentProcess: finalSnapshot?.currentProcess || '',
    });

    const report = {
      taskId: artifacts.taskId,
      task,
      backend: 'windows_uia',
      status,
      message,
      failureCategory,
      fallbackRecommended,
      startedAt,
      finishedAt,
      currentWindowTitle: finalSnapshot?.currentWindowTitle || this.currentWindowTitle,
      currentProcess: finalSnapshot?.currentProcess || '',
      lastAction: this.lastAction,
      lastVerification: this.lastVerification,
      artifacts: {
        runDirectory: artifacts.runDirectory,
        reportPath: artifacts.reportPath,
        tracePath: artifacts.tracePath,
        finalScreenshotPath: this.lastScreenshotPath,
      },
      history,
    };

    try {
      fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), 'utf-8');
      this.lastReportPath = artifacts.reportPath;
    } catch {
      this.lastReportPath = null;
    }

    this.lastTracePath = artifacts.tracePath;
    this.lastRunResult = {
      status,
      message,
      failureCategory,
      fallbackRecommended,
      verification: this.lastVerification,
      reportPath: this.lastReportPath,
      tracePath: this.lastTracePath,
      screenshotPath: this.lastScreenshotPath,
    };
  }

  private normalizeText(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private shouldRecommendVisualFallback(category: WindowsUIAFailureCategory): boolean {
    return category === 'verification' || category === 'timeout' || category === 'no_elements';
  }

  private appendTrace(tracePath: string, payload: Record<string, any>): void {
    try {
      fs.appendFileSync(tracePath, `${JSON.stringify(payload)}\n`, 'utf-8');
    } catch {
      // Trace persistence is best-effort.
    }
  }

  private summarizeSnapshot(snapshot: WindowsUIASnapshot, targetElementId?: number): Record<string, any> {
    const sampleElements = snapshot.elements.slice(0, 8).map((element) => ({
      id: element.id,
      name: element.name,
      controlType: element.controlType,
      automationId: element.automationId || '',
      value: element.value || '',
      isEnabled: element.isEnabled,
    }));
    const targetElement = targetElementId
      ? snapshot.elements.find((element) => element.id === targetElementId) || null
      : null;

    return {
      currentWindowTitle: snapshot.currentWindowTitle,
      currentProcess: snapshot.currentProcess,
      windowCount: snapshot.windows.length,
      elementCount: snapshot.elements.length,
      signature: snapshot.signature,
      targetElement: targetElement ? {
        id: targetElement.id,
        name: targetElement.name,
        controlType: targetElement.controlType,
        automationId: targetElement.automationId || '',
        value: targetElement.value || '',
        isEnabled: targetElement.isEnabled,
      } : null,
      sampleElements,
    };
  }
}
