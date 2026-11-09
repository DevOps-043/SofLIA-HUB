import type { DesktopAgentConfig } from '../../src/shared/desktop-agent';
export type { CaptureStrategy, DesktopAgentConfig } from '../../src/shared/desktop-agent';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { desktopConfigFields, desktopConfigSchema } from '../../src/shared/desktop-input';
import path from 'node:path';
import { app as electronApp } from 'electron';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';
import { COMPUTER_USE_MODEL_DEFAULTS } from './gemini-cu/model-registry';

export const DEFAULT_CONFIG: DesktopAgentConfig = {
  maxSteps: 120,
  screenshotWidth: 1024,
  screenshotHeight: 768,
  defaultActionDelay: 300,
  waitForChangeTimeout: 8000,
  waitForChangeInterval: 500,
  continuousObservationInterval: 2000,
  planningEnabled: true,
  memoryWindowSize: 10,
  model: SOFLIA_DEFAULT_MODEL,
  fallbackModel: SOFLIA_DEFAULT_MODEL,
  maxConsecutiveFailures: 3,
  stuckDetectionThreshold: 4,
  autoRecoverFromDialogs: true,
  replanOnStuck: true,
  maxRetryPerAction: 2,
  proactiveModel: SOFLIA_DEFAULT_MODEL,
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
  defaultStepBudget: 60,
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
  // Cerebro nativo entrenado para Computer Use. 'legacy' (loop de vision propio)
  // queda como rollback poniendo el valor en userData/desktop-agent-config.json.
  computerUseEngine: 'openai',
  computerUseModel: COMPUTER_USE_MODEL_DEFAULTS.recommended,
  computerUseFallbackModel: COMPUTER_USE_MODEL_DEFAULTS.compatibility,
  computerUseEconomyModel: COMPUTER_USE_MODEL_DEFAULTS.economy,
  computerUseDesktopEnabled: true,
  computerUseBrowserEnabled: true,
  // Protección contra instrucciones inyectadas en lo que se ve en pantalla
  // (páginas, documentos). Va activada por defecto: el agente actúa sobre la
  // máquina del usuario a partir de contenido que no controlamos.
  computerUsePromptInjectionDetection: true,
};

function getConfigPath(): string {
  const root = electronApp.getPath('userData');
  if (!path.isAbsolute(root)) throw new Error('Ruta de configuración no disponible.');
  return path.join(root, 'desktop-agent-config.json');
}

export function loadConfig(): DesktopAgentConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      if (fs.statSync(configPath).size > 128 * 1024) throw new Error('Configuración excesiva.');
      const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const saved = validSavedFields(parsed);
      return normalizeDesktopAgentConfig(applyLegacyCaptureCompatibility({ ...DEFAULT_CONFIG, ...saved }, saved));
    }
  } catch {
    // Defaults keep standalone runners compatible when Electron is unavailable.
  }
  return normalizeDesktopAgentConfig({ ...DEFAULT_CONFIG });
}

/** Impide que una configuración persistida reactive modelos retirados. */
export function normalizeDesktopAgentConfig(config: DesktopAgentConfig): DesktopAgentConfig {
  return {
    ...config,
    model: SOFLIA_DEFAULT_MODEL,
    fallbackModel: SOFLIA_DEFAULT_MODEL,
    proactiveModel: SOFLIA_DEFAULT_MODEL,
    computerUseModel: SOFLIA_DEFAULT_MODEL,
    computerUseFallbackModel: SOFLIA_DEFAULT_MODEL,
    computerUseEconomyModel: SOFLIA_DEFAULT_MODEL,
  };
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

/** Campos inválidos del legado no amplían límites; los demás conservan su valor. */
function validSavedFields(input: unknown): Partial<DesktopAgentConfig> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const fields: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(desktopConfigFields)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor && 'value' in descriptor) { const result = schema.safeParse(descriptor.value); if (result.success) fields[key] = result.data; }
  }
  return fields as Partial<DesktopAgentConfig>;
}
export function saveConfig(config: DesktopAgentConfig): void {
  const target = getConfigPath(), temporary = target + '.' + randomUUID() + '.tmp';
  const next = normalizeDesktopAgentConfig(desktopConfigSchema.parse(config));
  try {
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, target);
  } catch {
    try { fs.unlinkSync(temporary); } catch { /* No publicar éxito cuando el reemplazo falló. */ }
    throw new Error('No se pudo guardar la configuración de Desktop Agent.');
  }
}
