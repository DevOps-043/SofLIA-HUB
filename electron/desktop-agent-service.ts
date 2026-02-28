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
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const execAsync = promisify(execCb);

// Conditional Electron imports (service may be tested outside Electron)
let desktopCapturer: any;
let electronScreen: any;
let electronClipboard: any;
let electronApp: any;
try {
  const electron = require('electron');
  desktopCapturer = electron.desktopCapturer;
  electronScreen = electron.screen;
  electronClipboard = electron.clipboard;
  electronApp = electron.app;
} catch {
  // Running outside Electron
}

// ─── Types ──────────────────────────────────────────────────────────

export interface DesktopAgentConfig {
  maxSteps: number;
  screenshotWidth: number;
  screenshotHeight: number;
  defaultActionDelay: number;
  waitForChangeTimeout: number;
  waitForChangeInterval: number;
  continuousObservationInterval: number;
  planningEnabled: boolean;
  memoryWindowSize: number;
  model: string;
  fallbackModel: string;
  // ─── Proactive & Adaptive ───────────────────────────────────────
  maxConsecutiveFailures: number;    // Max failed actions before re-planning (default 3)
  stuckDetectionThreshold: number;   // Same screenshot hash N times → stuck (default 4)
  autoRecoverFromDialogs: boolean;   // Auto-dismiss unexpected popups/dialogs (default true)
  replanOnStuck: boolean;            // Re-analyze and re-plan when stuck (default true)
  maxRetryPerAction: number;         // Retry a failed action N times with adjusted coords (default 2)
  proactiveModel: string;            // Model for re-planning and recovery (uses PRO for harder reasoning)
  // ─── Multi-Agent ──────────────────────────────────────────────────
  maxConcurrentAgents: number;       // Max parallel agent tasks (default 3)
}

const DEFAULT_CONFIG: DesktopAgentConfig = {
  maxSteps: 60,
  screenshotWidth: 1280,
  screenshotHeight: 720,
  defaultActionDelay: 300,
  waitForChangeTimeout: 8000,
  waitForChangeInterval: 500,
  continuousObservationInterval: 2000,
  planningEnabled: true,
  memoryWindowSize: 10,
  model: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-2.5-flash',
  maxConsecutiveFailures: 3,
  stuckDetectionThreshold: 4,
  autoRecoverFromDialogs: true,
  replanOnStuck: true,
  maxRetryPerAction: 2,
  proactiveModel: 'gemini-3-pro-preview',
  maxConcurrentAgents: 3,
};

export type DesktopAction =
  | 'click' | 'double_click' | 'right_click'
  | 'drag' | 'mouse_down' | 'mouse_up' | 'mouse_move'
  | 'type' | 'key' | 'scroll'
  | 'wait' | 'wait_for_change' | 'wait_for_window'
  | 'focus_window' | 'minimize_window' | 'maximize_window'
  | 'restore_window' | 'close_window'
  | 'done' | 'fail';

export interface DesktopActionPayload {
  action: DesktopAction;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  windowTitle?: string;
  message: string;
  subGoal?: string;
  confidence?: number;
}

interface ActionHistoryEntry {
  step: number;
  action: DesktopActionPayload;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  screenshotHash?: string;
  wasRecovery?: boolean;    // True if this action was a recovery/adaptation step
}

interface TaskPlan {
  goal: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  replannedCount: number;   // How many times we've re-planned
}

export type AgentStatus = 'idle' | 'executing' | 'observing' | 'planning' | 'waiting' | 'recovering';

// ─── Multi-Agent Types ───────────────────────────────────────────────

export interface AgentTask {
  id: string;
  task: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  plan: TaskPlan | null;
  actionHistory: ActionHistoryEntry[];
  recovery: RecoveryContext;
  abortController: AbortController;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

// ─── Proactive Recovery Context ─────────────────────────────────────

interface RecoveryContext {
  consecutiveFailures: number;
  sameScreenCount: number;
  lastScreenHash: string;
  totalRecoveries: number;
  lastRecoveryStep: number;
}

export interface DesktopAgentStatus {
  status: AgentStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  plan: TaskPlan | null;
  lastAction: string | null;
  config: DesktopAgentConfig;
  // ─── Multi-Agent Status ──────────────────────────────────────
  activeTasks: Array<{ id: string; task: string; status: AgentStatus; step: number; maxSteps: number }>;
  totalActiveAgents: number;
}

// ─── Config persistence ─────────────────────────────────────────────

function getConfigPath(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'desktop-agent-config.json');
  } catch {
    return path.join(process.cwd(), 'desktop-agent-config.json');
  }
}

function loadConfig(): DesktopAgentConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    }
  } catch { /* defaults */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: DesktopAgentConfig): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[DesktopAgent] Error saving config:', err.message);
  }
}

// ─── Key mapping ────────────────────────────────────────────────────

const SEND_KEYS_MAP: Record<string, string> = {
  'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}', 'esc': '{ESC}',
  'backspace': '{BACKSPACE}', 'delete': '{DELETE}', 'space': ' ',
  'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
  'home': '{HOME}', 'end': '{END}', 'pageup': '{PGUP}', 'pagedown': '{PGDN}',
  'ctrl+a': '^a', 'ctrl+c': '^c', 'ctrl+v': '^v', 'ctrl+s': '^s',
  'ctrl+z': '^z', 'ctrl+y': '^y', 'ctrl+x': '^x', 'ctrl+f': '^f',
  'ctrl+n': '^n', 'ctrl+o': '^o', 'ctrl+p': '^p', 'ctrl+w': '^w',
  'ctrl+t': '^t', 'ctrl+shift+n': '^+n', 'ctrl+shift+t': '^+t',
  'ctrl+enter': '^{ENTER}', 'ctrl+shift+enter': '^+{ENTER}',
  'alt+f4': '%{F4}', 'alt+tab': '%{TAB}', 'alt+enter': '%{ENTER}',
  'shift+tab': '+{TAB}', 'shift+enter': '+{ENTER}',
  'win': '^{ESC}', 'win+d': '^{ESC}d', 'win+e': '^{ESC}e',
  'win+r': '^{ESC}r', 'win+l': '^{ESC}l',
  'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}', 'f5': '{F5}',
  'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}', 'f9': '{F9}', 'f10': '{F10}',
  'f11': '{F11}', 'f12': '{F12}',
};

// ─── P/Invoke type definition (shared across methods) ───────────────

const PINVOKE_HEADER = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W`;

// mouse_event flags
const LEFTDOWN = 2;
const LEFTUP = 4;
const RIGHTDOWN = 0x0008;
const RIGHTUP = 0x0010;
const WHEEL = 0x0800;

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

  // ─── Multi-Agent Registry ─────────────────────────────────────────
  private activeTasks: Map<string, AgentTask> = new Map();
  private taskIdCounter = 0;
  private taskQueue: Array<{ task: string; options?: { maxSteps?: number }; resolve: (v: string) => void; reject: (e: Error) => void }> = [];

  constructor() {
    super();
    this.config = loadConfig();
  }

  private generateTaskId(): string {
    return `agent-${++this.taskIdCounter}-${Date.now().toString(36)}`;
  }

  // ─── Public API ───────────────────────────────────────────────────

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
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
    const activeTasksList = Array.from(this.activeTasks.values()).map(t => ({
      id: t.id,
      task: t.task,
      status: t.status,
      step: t.currentStep,
      maxSteps: t.maxSteps,
    }));

    return {
      status: this.status,
      currentTask: this.currentTask,
      currentStep: this.currentStep,
      maxSteps: this.config.maxSteps,
      plan: this.currentPlan ? { ...this.currentPlan } : null,
      lastAction: this.actionHistory.length > 0
        ? this.actionHistory[this.actionHistory.length - 1].action.message
        : null,
      config: this.getConfig(),
      activeTasks: activeTasksList,
      totalActiveAgents: this.activeTasks.size,
    };
  }

  abort(taskId?: string): void {
    if (taskId) {
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
      this.stopObservation();
      console.log('[DesktopAgent] Todas las tareas canceladas.');
    }
  }

  abortAll(): void { this.abort(); }

  isRunning(): boolean {
    return this.status !== 'idle' || this.activeTasks.size > 0;
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  // ─── Screenshot ───────────────────────────────────────────────────

  async takeScreenshot(fullRes = false): Promise<string> {
    const size = fullRes
      ? { width: 1920, height: 1080 }
      : { width: this.config.screenshotWidth, height: this.config.screenshotHeight };
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: size,
    });
    if (sources.length === 0) throw new Error('No se encontraron pantallas.');
    const dataUrl = sources[0].thumbnail.toDataURL();
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }

  // ─── Coordinate Scaling ───────────────────────────────────────────

  private calculateScreenScale(): void {
    try {
      const primary = electronScreen.getPrimaryDisplay();
      const { width, height } = primary.size;
      const scaleFactor = primary.scaleFactor || 1;

      this.screenScale = {
        scaleX: (width * scaleFactor) / this.config.screenshotWidth,
        scaleY: (height * scaleFactor) / this.config.screenshotHeight,
      };
      console.log(`[DesktopAgent] Escala: ${width}x${height} (factor ${scaleFactor}) → screenshotScale ${this.screenScale.scaleX.toFixed(2)}x${this.screenScale.scaleY.toFixed(2)}`);
    } catch {
      // Fallback: assume 1920x1080 with default screenshot size
      this.screenScale = { scaleX: 1920 / this.config.screenshotWidth, scaleY: 1080 / this.config.screenshotHeight };
    }
  }

  private scale(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x * this.screenScale.scaleX),
      y: Math.round(y * this.screenScale.scaleY),
    };
  }

  // ─── PowerShell Helper ────────────────────────────────────────────

  private async ps(script: string): Promise<string> {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`,
      { timeout: 10000, windowsHide: true },
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
  async executeParallelTasks(tasks: Array<{ task: string; maxSteps?: number }>): Promise<Array<{ task: string; result: string; success: boolean }>> {
    if (!this.apiKey) throw new Error('API key de Gemini no configurada.');

    const results = await Promise.allSettled(
      tasks.map(t => this.executeTask(t.task, { maxSteps: t.maxSteps })),
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

  // ─── Main Task Execution ──────────────────────────────────────────

  async executeTask(task: string, options?: { maxSteps?: number }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada.');
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

  private async executeTaskInternal(task: string, options?: { maxSteps?: number }): Promise<string> {
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

        // Take screenshot
        const screenshot = await this.takeScreenshot();
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
        this.actionHistory.push(entry);

        // ─── Track consecutive failures for proactive recovery ────
        if (!actionSuccess) {
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

    const result = await model.generateContent([
      { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
      { text: prompt },
    ]);

    return this.parseVisionResponse(result.response.text());
  }

  private buildVisionPrompt(task: string, recoveryContext = false): string {
    const historyContext = this.getHistoryContext();
    const planContext = this.currentPlan
      ? `\nPLAN (sub-objetivos):\n${this.currentPlan.subGoals.map((g, i) =>
          `${i === this.currentPlan!.currentSubGoalIndex ? '>>> ' : '    '}${i + 1}. ${g}`,
        ).join('\n')}\n`
      : '';

    const recoveryNote = recoveryContext
      ? `\n⚠️ ATENCIÓN: Las últimas acciones fallaron (${this.recovery.consecutiveFailures} fallos). ANALIZA con cuidado y considera un enfoque diferente. Si ves un popup o diálogo inesperado, ciérralo primero.\n`
      : '';

    return `TAREA: ${task}
${planContext}${recoveryNote}
Paso ${this.currentStep + 1} de maximo ${this.config.maxSteps}.
${historyContext ? `\nHISTORIAL RECIENTE:\n${historyContext}\n` : ''}
Analiza la captura de pantalla y decide la siguiente accion.
Las coordenadas estan en el espacio de la imagen (${this.config.screenshotWidth}x${this.config.screenshotHeight}).

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "action": "click|double_click|right_click|drag|mouse_down|mouse_up|mouse_move|type|key|scroll|wait|wait_for_change|wait_for_window|focus_window|minimize_window|maximize_window|restore_window|close_window|done|fail",
  "x": number (coordenada X para click/drag inicio),
  "y": number (coordenada Y para click/drag inicio),
  "x2": number (solo drag: X final),
  "y2": number (solo drag: Y final),
  "text": "texto a escribir (para type)",
  "key": "enter|tab|escape|ctrl+s|ctrl+a|ctrl+c|ctrl+v|ctrl+z|alt+f4|alt+tab|shift+tab|win|win+e|win+r|f1-f12|up|down|left|right|home|end|pageup|pagedown|delete|backspace|space|ctrl+enter|ctrl+w|ctrl+n|ctrl+o|ctrl+shift+n",
  "direction": "up|down (para scroll)",
  "amount": number (clicks de scroll o segundos de espera),
  "windowTitle": "titulo parcial de ventana (para wait_for_window, focus_window, etc.)",
  "message": "descripcion breve de lo que estas haciendo",
  "subGoal": "sub-objetivo actual del plan (si hay plan)",
  "confidence": 0.0-1.0
}

ACCIONES DISPONIBLES:
- click/double_click/right_click: Acciones de mouse sobre coordenadas
- drag: Arrastrar de (x,y) a (x2,y2) — para mover archivos, redimensionar, etc.
- mouse_down/mouse_up/mouse_move: Control granular del mouse
- type: Escribir texto (usa clipboard, soporta Unicode)
- key: Presionar tecla o combinacion (ctrl+s, alt+f4, enter, tab, etc.)
- scroll: Scroll arriba/abajo con "direction" y "amount"
- wait: Esperar brevemente
- wait_for_change: Esperar hasta que la pantalla cambie
- wait_for_window: Esperar hasta que aparezca ventana con "windowTitle"
- focus_window: Traer ventana al frente
- minimize_window/maximize_window/restore_window/close_window: Gestionar ventanas
- done: Tarea completada — explicar resultado en "message"
- fail: Tarea imposible — explicar motivo en "message"

Si la tarea ya esta completada, usa "done".
Si detectas que no puedes avanzar despues de varios intentos, usa "fail".`;
  }

  private getHistoryContext(): string {
    const recent = this.actionHistory.slice(-this.config.memoryWindowSize);
    if (recent.length === 0) return '';
    return recent.map(h =>
      `  Paso ${h.step + 1}: ${h.action.action}${h.action.x ? ` (${h.action.x},${h.action.y})` : ''}${h.action.text ? ` "${h.action.text}"` : ''}${h.action.key ? ` [${h.action.key}]` : ''} — ${h.success ? '✓' : '✗'} ${h.action.message}`,
    ).join('\n');
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
      // If planning fails, proceed without a plan
      return { goal: task, subGoals: [task], currentSubGoalIndex: 0, estimatedSteps: 30, replannedCount: 0 };
    }
  }

  // ─── Internal: Action Execution ───────────────────────────────────

  private async executeAction(action: DesktopActionPayload): Promise<void> {
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
