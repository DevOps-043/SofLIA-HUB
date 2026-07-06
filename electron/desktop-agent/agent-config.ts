import fs from 'node:fs';
import path from 'node:path';
import { app as electronApp } from 'electron';

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
  computerUseEngine: 'gemini' | 'legacy';
  computerUseModel: string;
  /** Habilita el cerebro CU para el backend desktop (nut.js). */
  computerUseDesktopEnabled: boolean;
  /** Habilita el cerebro CU para el backend browser (Playwright). */
  computerUseBrowserEnabled: boolean;
  /** Detección de inyección de prompts en la captura (feature de seguridad de CU). */
  computerUsePromptInjectionDetection: boolean;
}

export const DEFAULT_CONFIG: DesktopAgentConfig = {
  maxSteps: 60,
  screenshotWidth: 1024,
  screenshotHeight: 768,
  defaultActionDelay: 300,
  waitForChangeTimeout: 8000,
  waitForChangeInterval: 500,
  continuousObservationInterval: 2000,
  planningEnabled: true,
  memoryWindowSize: 10,
  model: 'gemini-3.5-flash',
  fallbackModel: 'gemini-2.5-pro',
  maxConsecutiveFailures: 3,
  stuckDetectionThreshold: 4,
  autoRecoverFromDialogs: true,
  replanOnStuck: true,
  maxRetryPerAction: 2,
  proactiveModel: 'gemini-2.5-pro',
  // El backend desktop visual es single-instance: hay UN mouse, UN teclado y
  // el estado del paso (historial, layout activo) vive en el servicio. Dos
  // tareas visuales concurrentes se corrompen mutuamente; las adicionales
  // esperan en cola con timeout.
  maxConcurrentAgents: 1,
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
  focusedCaptureEnabled: true,
  focusedCapturePadding: 24,
  deterministicFirstEnabled: true,
  environmentContextEnabled: true,
  environmentRefreshEveryNSteps: 5,
  installedAppsIndexTtlMs: 6 * 60 * 60 * 1000,
  captureStrategy: 'active-monitor',
  minRenderScale: 0.5,
  maxScreenshotEdge: 1568,
  layoutBindingEnabled: true,
  legacyScaleFallbackEnabled: false,
  defaultStepBudget: 40,
  queueTimeoutMs: 60_000,
  keywordRoutingEnabled: true,
  inputBackend: 'nut',        // 'legacy' revierte a PowerShell/SetCursorPos (sin movimiento humano)
  humanMotionEnabled: true,
  humanTypingEnabled: true,
  uiaWorkerEnabled: true,     // false = sin accesibilidad UIA (solo OCR)
  uiaSparseThreshold: 8,
  uiaWakeDelayMs: 1200,
  ocrCaptureEdge: 1600,
  elementSourceEnabled: true, // false = fuente UIA legacy (ui-elements.ts) para rollback
  ocrElementsEnabled: true,
  visualParserEnabled: true,  // false = solo UIA + OCR (sin OmniParser/ONNX)
  maxDetectedElements: 60,
  elementDedupIouThreshold: 0.6,
  sufficientElementCount: 12,
  // Con UIA muy rica (Word/IDEs exponen 150+ elementos) el visual no aporta y
  // cuesta ~1-2s por paso: se omite. En apps opacas (UIA escaso) el visual corre.
  visualSkipWhenUiaRich: 40,
  // OmniParser icon_detect tiene scores intrinsecamente bajos (top ~0.47); su
  // umbral por defecto es 0.05. 0.10 filtra el ruido de fondo y conserva los
  // controles prominentes (un boton JUGAR/PLAY grande puntua alto). El cap
  // maxDetectedElements + NMS + prioridad de fuente controlan el volumen final.
  visualScoreThreshold: 0.10,
  visualNmsIou: 0.45,
  // Default 'legacy' hasta validar CU en la maquina; se activa poniendo 'gemini'
  // en userData/desktop-agent-config.json. Modelo recomendado por Google para CU.
  computerUseEngine: 'legacy',
  computerUseModel: 'gemini-3.5-flash',
  computerUseDesktopEnabled: true,
  computerUseBrowserEnabled: true,
  computerUsePromptInjectionDetection: false,
};

function getConfigPath(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'desktop-agent-config.json');
  } catch {
    return path.join(process.cwd(), 'desktop-agent-config.json');
  }
}

export function loadConfig(): DesktopAgentConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<DesktopAgentConfig>;
      return applyLegacyCaptureCompatibility({ ...DEFAULT_CONFIG, ...saved }, saved);
    }
  } catch {
    // Defaults keep standalone runners compatible when Electron is unavailable.
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Compatibilidad: configs guardadas antes de `captureStrategy` solo tienen
 * `focusedCaptureEnabled`; se mapea a la estrategia equivalente para no
 * cambiar el comportamiento elegido por el usuario.
 */
function applyLegacyCaptureCompatibility(
  config: DesktopAgentConfig,
  saved: Partial<DesktopAgentConfig>,
): DesktopAgentConfig {
  if (saved.captureStrategy === undefined && saved.focusedCaptureEnabled !== undefined) {
    return { ...config, captureStrategy: saved.focusedCaptureEnabled ? 'focused-window' : 'all-monitors' };
  }
  return config;
}

export function saveConfig(config: DesktopAgentConfig): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[DesktopAgent] Error saving config:', err.message);
  }
}
