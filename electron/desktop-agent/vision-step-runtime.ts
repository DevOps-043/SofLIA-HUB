import type { GoogleGenerativeAI } from '@google/generative-ai';
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
  // Hibrido de modelos: flash para pasos rutinarios (rapido/barato); se escala al
  // modelo pesado (Pro, config.fallbackModel) cuando el agente TIENE DIFICULTAD —
  // error del modelo, accion fallida, o la pantalla lleva >=2 pasos sin cambiar
  // (bucle de "clic->no pasa nada" como el visto con Word). Pro razona mejor y
  // rompe el bucle; al recuperar el progreso vuelve a flash.
  const struggling = params.useFallback
    || params.recovery.consecutiveFailures > 0
    || params.recovery.sameScreenCount >= 2;
  const modelId = struggling ? params.config.fallbackModel : params.config.model;
  if (struggling && !params.useFallback) {
    console.log(`[DesktopAgent] Escalando a modelo pesado (${modelId}) por dificultad — fallos:${params.recovery.consecutiveFailures} pantallaIgual:${params.recovery.sameScreenCount}`);
  }
  const model = params.ai.getGenerativeModel({ model: modelId });
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
