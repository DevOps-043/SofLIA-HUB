import { z } from 'zod';
import type { DesktopAgentConfig } from './desktop-agent';
import { computerInputSnapshot } from './computer-use-input';
import { desktopKeys } from './desktop-keys';

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const model = z.string().min(1).max(160).regex(/^[a-zA-Z0-9._/-]+$/);
const positiveCount = integer(1, 1000), probability = z.number().min(0).max(1);
const bool = z.boolean();
export const desktopConfigFields = {
  maxSteps: integer(1, 1000), screenshotWidth: integer(128, 8192), screenshotHeight: integer(128, 8192),
  defaultActionDelay: integer(0, 60000), waitForChangeTimeout: integer(100, 120000), waitForChangeInterval: integer(50, 30000),
  continuousObservationInterval: integer(500, 120000), planningEnabled: bool, memoryWindowSize: integer(1, 100),
  model, fallbackModel: model, maxConsecutiveFailures: integer(1, 50), stuckDetectionThreshold: integer(1, 100),
  autoRecoverFromDialogs: bool, replanOnStuck: bool, maxRetryPerAction: integer(0, 10), proactiveModel: model,
  maxConcurrentAgents: z.literal(1), gridEnabled: bool, gridStep: integer(10, 1000), zoomEnabled: bool,
  zoomResolution: integer(128, 4096), verificationEnabled: bool, maxTotalSteps: integer(1, 5000),
  summarizeEveryNSteps: positiveCount, maxRawHistorySteps: integer(1, 100), hierarchicalPlanningEnabled: bool,
  progressReportEveryNSteps: positiveCount, somEnabled: bool, somFallbackToGrid: bool, focusedCaptureEnabled: bool,
  focusedCapturePadding: integer(0, 1024), deterministicFirstEnabled: bool, environmentContextEnabled: bool,
  environmentRefreshEveryNSteps: positiveCount, installedAppsIndexTtlMs: integer(1000, 7 * 86400000),
  captureStrategy: z.enum(['all-monitors', 'active-monitor', 'focused-window']), minRenderScale: z.number().min(.1).max(1),
  maxScreenshotEdge: integer(128, 8192), layoutBindingEnabled: bool, legacyScaleFallbackEnabled: bool,
  defaultStepBudget: integer(1, 1000), queueTimeoutMs: integer(1000, 600000), keywordRoutingEnabled: bool,
  inputBackend: z.enum(['nut', 'legacy']), humanMotionEnabled: bool, humanTypingEnabled: bool, uiaWorkerEnabled: bool,
  uiaSparseThreshold: integer(0, 1000), uiaWakeDelayMs: integer(0, 30000), ocrCaptureEdge: integer(128, 8192),
  elementSourceEnabled: bool, ocrElementsEnabled: bool, visualParserEnabled: bool, maxDetectedElements: integer(1, 1000),
  elementDedupIouThreshold: probability, sufficientElementCount: integer(0, 1000), visualSkipWhenUiaRich: integer(0, 1000),
  visualScoreThreshold: probability, visualNmsIou: probability, computerUseEngine: z.preprocess(value => value === 'gemini' ? 'openai' : value, z.enum(['openai', 'legacy'])),
  computerUseModel: model, computerUseFallbackModel: model, computerUseEconomyModel: model,
  computerUseDesktopEnabled: bool, computerUseBrowserEnabled: bool, computerUsePromptInjectionDetection: bool,
} satisfies Record<keyof DesktopAgentConfig, z.ZodType>;
export const desktopConfigSchema = z.object(desktopConfigFields).strict();
export const desktopConfigUpdates = desktopConfigSchema.partial().refine(input => Object.keys(input).length > 0);
export const desktopProfileId = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().min(1).max(20000).refine(value => value.trim().length > 0 && !value.includes('\0'));
const url = z.string().max(4096).refine(value => {
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
});
const optionsFields = {
  maxSteps: integer(1, 1000).optional(), startUrl: url.optional(), backend: z.enum(['auto', 'browser', 'desktop', 'uia']).optional(),
  browserProfile: desktopProfileId.optional(), browserIsolated: bool.optional(), resetBrowserProfile: bool.optional(),
};
export const desktopTaskOptions = z.object({ ...optionsFields, useRealBrowser: bool.optional(), queueTimeoutMs: integer(1000, 600000).optional() }).strict();
const coordinate = z.number().finite().min(-100000).max(100000);
export const desktopInputs = {
  'execute-task': z.tuple([text, desktopTaskOptions.optional()]),
  'execute-parallel': z.tuple([z.array(z.object({ task: text, ...optionsFields }).strict()).min(1).max(4)]),
  'get-active-tasks': z.tuple([]), 'abort-task': z.tuple([z.string().min(1).max(256).regex(/^[a-zA-Z0-9_.:-]+$/)]),
  abort: z.tuple([]), 'get-status': z.tuple([]), 'get-config': z.tuple([]), 'list-browser-profiles': z.tuple([]),
  'reset-browser-profile': z.tuple([desktopProfileId]), 'set-config': z.tuple([desktopConfigUpdates]),
  'start-observation': z.tuple([text, text.optional()]), 'stop-observation': z.tuple([]),
  click: z.tuple([coordinate, coordinate]), 'double-click': z.tuple([coordinate, coordinate]), 'right-click': z.tuple([coordinate, coordinate]),
  drag: z.tuple([coordinate, coordinate, coordinate, coordinate]), type: z.tuple([z.string().max(20000).refine(value => !value.includes('\0'))]),
  key: z.tuple([z.string().min(1).max(160).refine(value => { try { desktopKeys(value); return true; } catch { return false; } })]), scroll: z.tuple([z.enum(['up', 'down']), integer(1, 100).optional()]),
  'focus-window': z.tuple([z.string().min(1).max(1000).refine(value => !value.includes('\0'))]),
  'list-windows': z.tuple([]), 'take-screenshot': z.tuple([bool.optional()]), 'run-calibration': z.tuple([]),
};
/** Mismo snapshot comprobado; cuota Desktop menor que documentos Computer Use. */
export function desktopInputSnapshot(args: unknown[]): unknown[] {
  const snapshot = computerInputSnapshot(args);
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 128 * 1024) throw new Error('invalid_payload');
  return snapshot;
}
