import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { ActionHistoryEntry, HistorySummary } from '../desktop-agent-types';
import { buildHistorySummaryPrompt } from './planning-prompts';

interface SummarizeDesktopHistoryInput {
  ai: GoogleGenerativeAI;
  modelName: string;
  actionHistory: ActionHistoryEntry[];
  currentStep: number;
  historySummaries: HistorySummary[];
}

export async function summarizeDesktopHistory(input: SummarizeDesktopHistoryInput): Promise<void> {
  const { ai, modelName, actionHistory, currentStep, historySummaries } = input;
  const fromStep = historySummaries.length > 0
    ? historySummaries[historySummaries.length - 1].toStep + 1
    : 0;
  const toStep = currentStep - 1;
  if (toStep <= fromStep) return;

  const stepsToSummarize = actionHistory.filter((entry) => entry.step >= fromStep && entry.step <= toStep);
  if (stepsToSummarize.length === 0) return;

  const historyPrompt = buildHistorySummaryPrompt(stepsToSummarize, fromStep, toStep);
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(historyPrompt);
    const summary = result.response.text().trim();
    historySummaries.push({ fromStep, toStep, summary });
    console.log(`[DesktopAgent] Resumen pasos ${fromStep + 1}-${toStep + 1}: ${summary.slice(0, 100)}...`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[DesktopAgent] Resumen de historial fallo:', message);
    historySummaries.push({
      fromStep,
      toStep,
      summary: `Pasos ${fromStep + 1}-${toStep + 1}: ${stepsToSummarize.length} acciones ejecutadas.`,
    });
  }
}
