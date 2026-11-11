/** Contratos serializables Desktop: fuente canónica sin imports runtime. */

/** Opciones serializables; AbortSignal pertenece sólo a la ejecución interna de main. */
export interface DesktopTaskOptions {
  maxSteps?: number; startUrl?: string; backend?: 'auto' | 'browser' | 'desktop' | 'uia';
  browserProfile?: string; browserIsolated?: boolean; resetBrowserProfile?: boolean;
  useRealBrowser?: boolean; queueTimeoutMs?: number;
}
export interface ParallelDesktopTaskRequest extends Omit<DesktopTaskOptions, 'useRealBrowser' | 'queueTimeoutMs'> { task: string }
export interface AutomationOperationResult { success: boolean; error?: string; message?: string }
export interface DesktopTaskView {
  id: string; task: string; status: AgentStatus; currentStep: number; maxSteps: number;
  startedAt?: number; completedAt?: number; result?: string; error?: string;
  backend: 'desktop_visual' | 'browser_web' | 'windows_uia'; currentUrl: string | null;
}
export interface DesktopAgentApi {
  readonly nativeActionReview?: true;
  executeTask(task: string, options?: DesktopTaskOptions): Promise<AutomationOperationResult & { outcome?: DesktopTaskOutcome; status?: DesktopAgentStatus }>;
  executeParallel(tasks: ParallelDesktopTaskRequest[]): Promise<AutomationOperationResult & { results?: Array<{ task: string; result: string; success: boolean }> }>;
  getActiveTasks(): Promise<AutomationOperationResult & { tasks?: DesktopTaskView[]; count?: number }>;
  abortTask(taskId: string): Promise<AutomationOperationResult>;
  abort(): Promise<AutomationOperationResult>;
  getStatus(): Promise<DesktopAgentStatus>;
  getConfig(): Promise<DesktopAgentConfig>;
  listBrowserProfiles(): Promise<AutomationOperationResult & { profiles?: BrowserProfileDescriptor[] }>;
  resetBrowserProfile(profileId: string): Promise<AutomationOperationResult & { profileId?: string; path?: string; removed?: boolean }>;
  setConfig(updates: Partial<DesktopAgentConfig>): Promise<AutomationOperationResult & { config?: DesktopAgentConfig }>;
  startObservation(objective: string, rules?: string): Promise<AutomationOperationResult>;
  stopObservation(): Promise<AutomationOperationResult>;
  click(x: number, y: number): Promise<AutomationOperationResult>;
  doubleClick(x: number, y: number): Promise<AutomationOperationResult>;
  rightClick(x: number, y: number): Promise<AutomationOperationResult>;
  drag(x1: number, y1: number, x2: number, y2: number): Promise<AutomationOperationResult>;
  type(text: string): Promise<AutomationOperationResult>;
  key(key: string): Promise<AutomationOperationResult>;
  scroll(direction: 'up' | 'down', amount?: number): Promise<AutomationOperationResult>;
  focusWindow(title: string): Promise<AutomationOperationResult & { found?: boolean }>;
  listWindows(): Promise<AutomationOperationResult & { windows?: Array<{ title: string; process: string; pid: number }> }>;
  takeScreenshot(fullRes?: boolean): Promise<AutomationOperationResult & { data?: string }>;
  runCalibration(): Promise<AutomationOperationResult & { report?: CalibrationReport }>;
}

type Point = { x: number; y: number };

/** Estrategia de captura de pantalla para los pasos de vision. */
export type CaptureStrategy = 'all-monitors' | 'active-monitor' | 'focused-window';

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
  maxConsecutiveFailures: number;
  stuckDetectionThreshold: number;
  autoRecoverFromDialogs: boolean;
  replanOnStuck: boolean;
  maxRetryPerAction: number;
  proactiveModel: string;
  maxConcurrentAgents: number;
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
  focusedCaptureEnabled: boolean;
  focusedCapturePadding: number;
  // --- Orquestacion determinista-primero ---
  deterministicFirstEnabled: boolean;
  environmentContextEnabled: boolean;
  environmentRefreshEveryNSteps: number;
  installedAppsIndexTtlMs: number;
  // --- Pipeline de coordenadas ---
  captureStrategy: CaptureStrategy;
  minRenderScale: number;
  maxScreenshotEdge: number;
  layoutBindingEnabled: boolean;
  legacyScaleFallbackEnabled: boolean;
  // --- Ciclo de vida ---
  defaultStepBudget: number;
  queueTimeoutMs: number;
  keywordRoutingEnabled: boolean;
  // --- Entrada nativa (nut.js) y localizacion por texto ---
  inputBackend: 'nut' | 'legacy';
  humanMotionEnabled: boolean;
  humanTypingEnabled: boolean;
  uiaWorkerEnabled: boolean;
  uiaSparseThreshold: number;
  uiaWakeDelayMs: number;
  ocrCaptureEdge: number;
  // --- Fuente de elementos del Set-of-Marks (UIA + OCR + visual) ---
  elementSourceEnabled: boolean;
  ocrElementsEnabled: boolean;
  visualParserEnabled: boolean;
  maxDetectedElements: number;
  elementDedupIouThreshold: number;
  /** Si UIA devuelve >= este numero de elementos, no se corre OCR. */
  sufficientElementCount: number;
  /** Si UIA devuelve >= este numero, tampoco se corre el parser visual (ONNX caro). */
  visualSkipWhenUiaRich: number;
  /** Score minimo del detector visual (0-1); mas alto = menos marcas de ruido. */
  visualScoreThreshold: number;
  /** IoU de la NMS del detector visual (0-1). */
  visualNmsIou: number;
  // --- Gemini Computer Use (cerebro nativo entrenado, tool computer_use) ---
  /** 'gemini' usa la Computer Use API; 'legacy' el loop de vision propio (fallback). */
  computerUseEngine: 'openai' | 'legacy';
  /** Perfil recomendado. Resolver siempre via `gemini-cu/model-registry`. */
  computerUseModel: string;
  /** Perfil compatibilidad: respaldo ante indisponibilidad del proveedor. */
  computerUseFallbackModel: string;
  /** Perfil economia: flujos sencillos, repetitivos y de bajo riesgo. */
  computerUseEconomyModel: string;
  /** Habilita el cerebro CU para el backend desktop (nut.js). */
  computerUseDesktopEnabled: boolean;
  /** Habilita el cerebro CU para el backend browser (Playwright). */
  computerUseBrowserEnabled: boolean;
  /** Detección de inyección de prompts en la captura (feature de seguridad de CU). */
  computerUsePromptInjectionDetection: boolean;
}

export interface TaskPlan {
  goal: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  replannedCount: number;
}

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
  /** Backend sugerido por el planner para esta fase (usa el contexto de entorno). */
  backendPreferido?: 'browser' | 'uia' | 'desktop';
}

export interface UIElement {
  id: number;
  name: string;
  controlType: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
  automationId?: string;
  value?: string;
}

export interface HistorySummary {
  fromStep: number;
  toStep: number;
  summary: string;
}

export type AgentStatus = 'idle' | 'executing' | 'observing' | 'planning' | 'waiting' | 'recovering';

export interface DesktopAgentStatus {
  status: AgentStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentBackend?: 'desktop_visual' | 'browser_web' | 'windows_uia' | null;
  currentUrl?: string | null;
  currentBrowserProfileId?: string | null;
  currentBrowserProfileMode?: 'persistent' | 'isolated' | null;
  lastVerification?: string | null;
  lastTracePath?: string | null;
  lastReportPath?: string | null;
  lastScreenshotPath?: string | null;
  plan: TaskPlan | null;
  lastAction: string | null;
  config: DesktopAgentConfig;
  platformCapabilities?: PlatformCapabilities;
  activeTasks: Array<{
    id: string;
    task: string;
    status: AgentStatus;
    step: number;
    maxSteps: number;
    backend?: 'desktop_visual' | 'browser_web' | 'windows_uia';
    currentUrl?: string | null;
    browserProfileId?: string | null;
    browserProfileMode?: 'persistent' | 'isolated' | null;
  }>;
  totalActiveAgents: number;
}

export type DesktopSessionKind =
  | 'windows'
  | 'macos'
  | 'linux-x11'
  | 'linux-wayland'
  | 'linux-headless'
  | 'unsupported';

export type PlatformCapabilities = {
  platform: NodeJS.Platform;
  desktopSession: DesktopSessionKind;
  screenshots: boolean;
  activeWindow: boolean;
  guiAutomation: boolean;
  windowControls: boolean;
  powerControls: boolean;
  volumeControls: boolean;
  wifiControls: boolean;
  backgroundHost: boolean;
  updater: boolean;
  windowsUIA: boolean;
  linuxXdotool: boolean;
  unsupportedReason?: string;
};

/**
 * Contrato de finalizacion estructurado de una tarea del agente de escritorio.
 * Permite al agente conversacional distinguir "completada" de "se agotaron los
 * pasos" o "expiro en cola", en lugar de interpretar un string plano.
 */
export type DesktopTaskEstado =
  | 'completada'
  | 'fallida'
  | 'cancelada'
  | 'presupuesto_agotado'
  | 'cola_expirada';

export type DesktopTaskOutcome = {
  taskId: string | null;
  estado: DesktopTaskEstado;
  mensaje: string;
  pasosEjecutados: number;
  duracionMs: number;
  ultimaVentana?: string;
};

export type ScreenshotVirtualBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 'passive' valida solo la aritmetica de coordenadas y NUNCA toca el mouse.
 * 'cursor' agrega el round-trip real SetCursorPos/GetCursorPos, que secuestra
 * el puntero del usuario y por eso solo corre a peticion explicita.
 */
export type CalibrationMode = 'cursor' | 'passive';

export type CalibrationPointResult = {
  dip: Point;
  imagen: Point | null;
  esperadoFisico: Point;
  /** Solo en modo 'cursor': posicion fisica real leida tras mover el puntero. */
  obtenidoFisico: Point | null;
  deltaPx: number;
  ok: boolean;
};

export type CalibrationMonitorReport = {
  monitor: string;
  boundsDip: ScreenshotVirtualBounds;
  scaleFactor: number;
  puntos: CalibrationPointResult[];
  ok: boolean;
  /** Motivo por el que el round-trip de cursor no pudo leerse, si aplica. */
  errorCursor?: string;
};

export type CalibrationReport = {
  ok: boolean;
  modo: CalibrationMode;
  toleranciaPx: number;
  monitores: CalibrationMonitorReport[];
  generadoEn: number;
  error?: string;
};

export interface BrowserProfileDescriptor {
  id: string;
  path: string;
  exists: boolean;
  lastModifiedAt: string | null;
}
