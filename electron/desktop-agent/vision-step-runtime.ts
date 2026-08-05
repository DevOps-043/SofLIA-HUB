import type { GoogleGenerativeAI } from '@google/generative-ai';
import { SOFLIA_RUNTIME_MODEL } from '../../src/shared/soflia-runtime-model';
import { buildHistoryContext } from './history-context';
import { parseDesktopActionResponse } from './parsers';
import { buildVisionPrompt } from './vision-prompt';
import type {
  ActionHistoryEntry,
  DesktopAgentConfig,
  DesktopActionPayload,
  HistorySummary,
  RecoveryContext,
  StrategicPlan,
  TaskPlan,
  UIElement,
} from '../desktop-agent-types';

type VisionContentPart =
  | { inlineData: { mimeType: 'image/png'; data: string } }
  | { text: string };

export async function runDesktopVisionStep(params: {
  task: string;
  screenshotBase64: string;
  useFallback: boolean;
  recoveryContext: boolean;
  ai: GoogleGenerativeAI;
  config: DesktopAgentConfig;
  actionHistory: ActionHistoryEntry[];
  strategicPlan: StrategicPlan | null;
  currentPlan: TaskPlan | null;
  recovery: RecoveryContext;
  historySummaries: HistorySummary[];
  lastZoomImage: string | null;
  consumeLastZoomImage: () => void;
  captureMode: 'som' | 'grid';
  currentUIElements: UIElement[];
  screenshotWidth: number;
  screenshotHeight: number;
  monitorContext: string;
  environmentContext: string;
  currentStep: number;
}): Promise<DesktopActionPayload> {
  // Los reintentos conservan el modelo único; un fallo visual no debe cambiar
  // silenciosamente de proveedor o volver a un modelo retirado.
  const struggling = params.useFallback
    || params.recovery.consecutiveFailures > 0
    || params.recovery.sameScreenCount >= 2;
  if (struggling && !params.useFallback) {
    console.log(`[DesktopAgent] Reintentando con ${SOFLIA_RUNTIME_MODEL} y contexto de recuperación — fallos:${params.recovery.consecutiveFailures} pantallaIgual:${params.recovery.sameScreenCount}`);
  }
  const model = params.ai.getGenerativeModel({ model: SOFLIA_RUNTIME_MODEL });
  const prompt = buildVisionPrompt({
    task: params.task,
    recoveryContext: params.recoveryContext,
    historyContext: buildHistoryContext(params.actionHistory, params.config),
    strategicPlan: params.strategicPlan,
    currentPlan: params.currentPlan,
    recovery: params.recovery,
    historySummaries: params.historySummaries,
    hasZoomImage: Boolean(params.lastZoomImage),
    captureMode: params.captureMode,
    currentUIElements: params.currentUIElements,
    screenshotWidth: params.screenshotWidth,
    screenshotHeight: params.screenshotHeight,
    monitorContext: params.monitorContext,
    environmentContext: params.environmentContext,
    currentStep: params.currentStep,
    config: params.config,
  });

  const parts: VisionContentPart[] = [
    { inlineData: { mimeType: 'image/png', data: params.screenshotBase64 } },
  ];
  if (params.lastZoomImage) {
    parts.push({ inlineData: { mimeType: 'image/png', data: params.lastZoomImage } });
    params.consumeLastZoomImage();
  }
  parts.push({ text: prompt });

  const result = await model.generateContent(parts);
  return parseDesktopActionResponse(result.response.text());
}
