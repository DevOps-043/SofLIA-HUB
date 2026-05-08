import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { StrategicPlan, TaskPlan } from '../desktop-agent-types';
import { parseVisionResponse } from './parsers';
import { buildPhaseCompletionPrompt } from './planning-prompts';

interface CheckPhaseCompletionInput {
  ai: GoogleGenerativeAI;
  modelName: string;
  screenshotBase64: string;
  strategicPlan: StrategicPlan | null;
  currentPlan: TaskPlan | null;
  currentStep: number;
  emit: (eventName: string, payload: unknown) => void;
}

type PhaseCompletionPayload = {
  completed?: boolean;
  reason?: string;
};

export async function checkStrategicPhaseCompletion(input: CheckPhaseCompletionInput): Promise<void> {
  const { ai, modelName, screenshotBase64, strategicPlan, currentPlan, currentStep, emit } = input;
  if (!strategicPlan) return;

  const phase = strategicPlan.phases[strategicPlan.currentPhaseIndex];
  if (!phase || phase.status !== 'in_progress') return;

  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
      { text: buildPhaseCompletionPrompt(phase) },
    ]);
    const parsed = parseVisionResponse(result.response.text()) as PhaseCompletionPayload;

    if (!parsed.completed) {
      return;
    }

    phase.status = 'completed';
    phase.endStep = currentStep;
    console.log(`[DesktopAgent] Fase completada: "${phase.name}" - ${parsed.reason || ''}`);
    emit('phase-completed', {
      phase,
      phaseIndex: strategicPlan.currentPhaseIndex,
      totalPhases: strategicPlan.phases.length,
      nextPhase: strategicPlan.phases[strategicPlan.currentPhaseIndex + 1] || null,
    });

    if (strategicPlan.currentPhaseIndex < strategicPlan.phases.length - 1) {
      strategicPlan.currentPhaseIndex++;
      const next = strategicPlan.phases[strategicPlan.currentPhaseIndex];
      next.status = 'in_progress';
      next.startStep = currentStep;
      if (currentPlan) {
        currentPlan.subGoals = next.subGoals;
        currentPlan.currentSubGoalIndex = 0;
      }
    }
  } catch {
    // phase checks are best-effort
  }
}
