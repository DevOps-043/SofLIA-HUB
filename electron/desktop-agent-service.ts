import { EventEmitter } from 'node:events';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrowserWebService } from './browser-web-service';
import { WindowsUIAService } from './windows-uia-service';
import { DesktopKeyboardControls } from './desktop-agent/keyboard-controls';
import { DesktopMouseControls } from './desktop-agent/mouse-controls';
import { DesktopWindowControls } from './desktop-agent/window-controls';
import type { ScreenshotLayout } from './desktop-agent/types';
import type { DesktopTaskQueueItem } from './desktop-agent/task-control';
import {
  type DesktopAgentConfig,
  type DesktopActionPayload,
  type ActionHistoryEntry,
  type TaskPlan,
  type StrategicPlan,
  type UIElement,
  type HistorySummary,
  type AgentStatus,
  type AgentTask,
  type RecoveryContext,
  type DesktopAgentStatus,
  loadConfig,
} from './desktop-agent-types';
import { attachDesktopAgentLifecycle, type DesktopAgentLifecycleApi } from './desktop-agent/service-lifecycle';
import { attachDesktopAgentScreenshot, type DesktopAgentScreenshotApi } from './desktop-agent/service-screenshot';
import { attachDesktopAgentCoordinates, type DesktopAgentCoordinateApi } from './desktop-agent/service-coordinates';
import { attachDesktopAgentCoordinateActions, type DesktopAgentCoordinateActionApi } from './desktop-agent/service-coordinate-actions';
import { attachDesktopAgentControls, type DesktopAgentControlsApi } from './desktop-agent/service-controls';
import { attachDesktopAgentTasks, type DesktopAgentTaskApi } from './desktop-agent/service-tasks';
import { attachDesktopAgentObservation, type DesktopAgentObservationApi } from './desktop-agent/service-observation';
import { attachDesktopAgentPlanning, type DesktopAgentPlanningApi } from './desktop-agent/service-planning';

export type { DesktopAgentConfig, DesktopActionPayload, UIElement, AgentStatus, AgentTask, DesktopAgentStatus };

export interface DesktopAgentService
  extends DesktopAgentLifecycleApi,
    DesktopAgentScreenshotApi,
    DesktopAgentCoordinateApi,
    DesktopAgentCoordinateActionApi,
    DesktopAgentControlsApi,
    DesktopAgentTaskApi,
    DesktopAgentObservationApi,
    DesktopAgentPlanningApi {}

export class DesktopAgentService extends EventEmitter {
  config: DesktopAgentConfig = loadConfig();
  status: AgentStatus = 'idle';
  currentTask: string | null = null;
  actionHistory: ActionHistoryEntry[] = [];
  currentPlan: TaskPlan | null = null;
  currentStep = 0;
  abortController: AbortController | null = null;
  observationInterval: ReturnType<typeof setInterval> | null = null;
  observationRunning = false;
  screenScale = { scaleX: 1.5, scaleY: 1.5 };
  apiKey = '';
  genAI: GoogleGenerativeAI | null = null;
  recovery: RecoveryContext = { consecutiveFailures: 0, sameScreenCount: 0, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 };
  strategicPlan: StrategicPlan | null = null;
  historySummaries: HistorySummary[] = [];
  lastZoomImage: string | null = null;
  currentUIElements: UIElement[] = [];
  captureMode: 'som' | 'grid' = 'grid';
  lastActualScreenshotWidth = 0;
  lastActualScreenshotHeight = 0;
  lastScreenshotLayout: ScreenshotLayout | null = null;
  activeTasks: Map<string, AgentTask> = new Map();
  taskIdCounter = 0;
  taskQueue: DesktopTaskQueueItem[] = [];
  browserWeb = new BrowserWebService();
  windowsUIA = new WindowsUIAService(this);
  mouseControls: DesktopMouseControls;
  keyboardControls: DesktopKeyboardControls;
  windowControls: DesktopWindowControls;

  constructor() {
    super();
    this.mouseControls = new DesktopMouseControls((script) => this.ps(script), (x, y) => this.scale(x, y), (ms) => this.delay(ms));
    this.keyboardControls = new DesktopKeyboardControls((script) => this.ps(script), (ms) => this.delay(ms));
    this.windowControls = new DesktopWindowControls((script) => this.ps(script));
    this.registerExternalBackendEventForwarding(this.browserWeb);
    this.registerExternalBackendEventForwarding(this.windowsUIA);
  }
}

attachDesktopAgentLifecycle(DesktopAgentService);
attachDesktopAgentScreenshot(DesktopAgentService);
attachDesktopAgentCoordinates(DesktopAgentService);
attachDesktopAgentCoordinateActions(DesktopAgentService);
attachDesktopAgentControls(DesktopAgentService);
attachDesktopAgentTasks(DesktopAgentService);
attachDesktopAgentObservation(DesktopAgentService);
attachDesktopAgentPlanning(DesktopAgentService);
