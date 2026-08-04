import { EventEmitter } from 'node:events';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrowserWebService } from './browser-web-service';
import { WindowsUIAService } from './windows-uia-service';
import { detectPlatformCapabilities, type PlatformCapabilities } from './platform-capabilities';
import { DesktopKeyboardControls } from './desktop-agent/keyboard-controls';
import { DesktopMouseControls } from './desktop-agent/mouse-controls';
import { DesktopWindowControls } from './desktop-agent/window-controls';
import { PowerShellWorker } from './desktop-agent/native-worker/powershell-worker';
import type { VisualParser } from './desktop-agent/visual-parser/types';
import { createInputDriver } from './desktop-agent/input-driver';
import type { InputDriver } from './desktop-agent/input-driver/types';
import type { ScreenshotLayout } from './desktop-agent/types';
import type { CompositeScreenshotResult } from './desktop-agent/service-types';
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
import type { IntegratedBrowserService } from './integrated-browser';

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
  environmentContextText = '';
  lastScreenshotLayout: ScreenshotLayout | null = null;
  /** Layout de la captura de DECISION del paso actual; inmune a capturas de verificacion/zoom. */
  activeStepLayout: ScreenshotLayout | null = null;
  /** Captura raw de DECISION del paso actual, antes de marcas/grilla. */
  lastDecisionCapture: CompositeScreenshotResult | null = null;
  /** Target resuelto por la ultima accion, consumido por la verificacion. */
  lastResolvedActionTarget: import('./desktop-agent-types').ResolvedActionTarget | null = null;
  /** Memoria corta de targets que no cambiaron la pantalla. */
  failedActionTargets: import('./desktop-agent-types').FailedActionTargetMemory[] = [];
  activeTasks: Map<string, AgentTask> = new Map();
  taskIdCounter = 0;
  taskQueue: DesktopTaskQueueItem[] = [];
  platformCapabilities: PlatformCapabilities = detectPlatformCapabilities();
  /** Worker UIA persistente (solo Windows); creado perezosamente en el primer uso. */
  uiaWorker: PowerShellWorker | null = null;
  /** Parser visual (OmniParser/ONNX); memoizado para conservar la sesion ONNX. */
  visualParser: VisualParser | null = null;
  /** Ultimo paso en que el window-lock re-enfoco; cooldown anti-churn. */
  lastWindowRefocusStep = -100;
  /** Ultimo zoom del modelo (espacio IMAGEN + paso); evidencia para desbloquear un click crudo. */
  lastZoomAt: { x: number; y: number; step: number } | null = null;
  /** Evita repetir el diagnostico ONNX en cada frame. */
  visualParserAvailabilityLogged = false;
  /** Ventana objetivo protegida durante tareas de apps nativas/launchers. */
  targetWindowLock: import('./desktop-agent-types').TargetWindowLock | null = null;
  browserWeb = new BrowserWebService();
  integratedBrowser: IntegratedBrowserService | null;
  windowsUIA = new WindowsUIAService(this);
  mouseControls: DesktopMouseControls;
  keyboardControls: DesktopKeyboardControls;
  windowControls: DesktopWindowControls;
  /** Driver de entrada de alto nivel resuelto (nut.js o legacy). */
  inputDriver: InputDriver | null = null;

  constructor(integratedBrowser: IntegratedBrowserService | null = null) {
    super();
    this.integratedBrowser = integratedBrowser;
    this.mouseControls = new DesktopMouseControls((script) => this.ps(script), (x, y) => this.scale(x, y), (ms) => this.delay(ms));
    this.keyboardControls = new DesktopKeyboardControls((script) => this.ps(script), (ms) => this.delay(ms));
    // psEncoded (base64) preserva los scripts multilinea; ps() aplana \n a ';'
    // y corrompe las definiciones C# de Add-Type de los controles de ventana.
    this.windowControls = new DesktopWindowControls((script) => this.psEncoded(script));
    this.setupInputDriver();
    this.registerExternalBackendEventForwarding(this.browserWeb);
    if (this.platformCapabilities.windowsUIA) {
      this.registerExternalBackendEventForwarding(this.windowsUIA);
    }
  }

  /**
   * Elige el backend de entrada (nut.js con movimiento humano, o legacy). Con
   * movimiento humano activo, se inyecta el driver en mouse/teclado para que
   * toda síntesis pase por él; si está desactivado, se usa la vía raw directa.
   */
  private setupInputDriver(): void {
    const driver = createInputDriver({
      backend: this.config.inputBackend ?? 'nut',
      mouse: this.mouseControls,
      keyboard: this.keyboardControls,
    });
    this.inputDriver = driver;
    const humanEnabled = this.config.humanMotionEnabled !== false && driver.capacidades().backend === 'nut';
    const typingEnabled = this.config.humanTypingEnabled !== false && driver.capacidades().backend === 'nut';
    this.mouseControls.setInputDriver(humanEnabled ? driver : null);
    this.keyboardControls.setInputDriver(typingEnabled ? driver : null);
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
