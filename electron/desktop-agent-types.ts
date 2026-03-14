/**
 * Tipos, constantes y configuración para DesktopAgentService.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app as electronApp } from 'electron';

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
  maxConsecutiveFailures: number;
  stuckDetectionThreshold: number;
  autoRecoverFromDialogs: boolean;
  replanOnStuck: boolean;
  maxRetryPerAction: number;
  proactiveModel: string;
  // ─── Multi-Agent ──────────────────────────────────────────────────
  maxConcurrentAgents: number;
  // ─── V2: Precision & Long Tasks ─────────────────────────────────
  gridEnabled: boolean;
  gridStep: number;
  zoomEnabled: boolean;
  zoomResolution: number;
  verificationEnabled: boolean;
  maxTotalSteps: number;
  summarizeEveryNSteps: number;
  maxRawHistorySteps: number;
  hierarchicalPlanningEnabled: boolean;
  progressReportEveryNSteps: number;
  somEnabled: boolean;
  somFallbackToGrid: boolean;
}

export const DEFAULT_CONFIG: DesktopAgentConfig = {
  maxSteps: 200,
  screenshotWidth: 1024,
  screenshotHeight: 768,
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
  proactiveModel: 'gemini-3.1-pro-preview',
  maxConcurrentAgents: 3,
  // V2 defaults
  gridEnabled: true,
  gridStep: 100,
  zoomEnabled: true,
  zoomResolution: 512,
  verificationEnabled: true,
  maxTotalSteps: 500,
  summarizeEveryNSteps: 15,
  maxRawHistorySteps: 8,
  hierarchicalPlanningEnabled: true,
  progressReportEveryNSteps: 25,
  somEnabled: true,
  somFallbackToGrid: true,
};

export type DesktopAction =
  | 'click' | 'double_click' | 'right_click'
  | 'drag' | 'mouse_down' | 'mouse_up' | 'mouse_move'
  | 'type' | 'key' | 'scroll'
  | 'wait' | 'wait_for_change' | 'wait_for_window'
  | 'focus_window' | 'minimize_window' | 'maximize_window'
  | 'restore_window' | 'close_window'
  | 'zoom' | 'click_element' | 'type_in_element'
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
  // V2: Zoom
  zoomX?: number;
  zoomY?: number;
  zoomRadius?: number;
  // V2: Set-of-Marks element targeting
  elementId?: number;
}

export interface ActionHistoryEntry {
  step: number;
  action: DesktopActionPayload;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  screenshotHash?: string;
  wasRecovery?: boolean;
  verificationFailed?: boolean;
}

export interface TaskPlan {
  goal: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  replannedCount: number;
}

// V2: Hierarchical Strategic Plan
export interface StrategicPlan {
  goal: string;
  phases: TaskPhase[];
  currentPhaseIndex: number;
  totalEstimatedSteps: number;
}

export interface TaskPhase {
  name: string;
  description: string;
  successCriteria: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startStep?: number;
  endStep?: number;
}

// V2: UI Automation element
export interface UIElement {
  id: number;
  name: string;
  controlType: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
}

// V2: History summary
export interface HistorySummary {
  fromStep: number;
  toStep: number;
  summary: string;
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

export interface RecoveryContext {
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

export function loadConfig(): DesktopAgentConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    }
  } catch { /* defaults */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: DesktopAgentConfig): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[DesktopAgent] Error saving config:', err.message);
  }
}

// ─── Key mapping ────────────────────────────────────────────────────

export const SEND_KEYS_MAP: Record<string, string> = {
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

export const PINVOKE_HEADER = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W`;

// mouse_event flags
export const LEFTDOWN = 2;
export const LEFTUP = 4;
export const RIGHTDOWN = 0x0008;
export const RIGHTUP = 0x0010;
export const WHEEL = 0x0800;
