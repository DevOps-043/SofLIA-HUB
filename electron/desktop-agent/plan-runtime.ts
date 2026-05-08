import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesktopAgentConfig, StrategicPlan, TaskPlan } from '../desktop-agent-types';
import { parseVisionResponse } from './parsers';
import { buildFlatPlanPrompt, buildStrategicPlanPrompt } from './planning-prompts';
interface CreateDesktopTaskPlanInput {
  ai: GoogleGenerativeAI;
  config: DesktopAgentConfig;
  task: string;
  screenshotBase64: string;
}
type ParsedPhase = {
  name?: string;
  description?: string;
  successCriteria?: string;
  subGoals?: string[];
  estimatedSteps?: number;
};
type ParsedPlan = {
  goal?: string;
  phases?: ParsedPhase[];
  totalEstimatedSteps?: number;
  subGoals?: string[];
  estimatedSteps?: number;
};

export async function createDesktopTaskPlan(input: CreateDesktopTaskPlanInput): Promise<{
  taskPlan: TaskPlan;
  strategicPlan: StrategicPlan | null;
}> {
  const { ai, config, task, screenshotBase64 } = input;

  if (config.hierarchicalPlanningEnabled) {
    try {
      const proModel = ai.getGenerativeModel({ model: config.proactiveModel });
      const result = await proModel.generateContent([
        { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
        { text: buildStrategicPlanPrompt(task) },
      ]);
      const parsed = parseVisionResponse(result.response.text()) as ParsedPlan;

      if (parsed.phases && parsed.phases.length > 0) {
        const strategicPlan: StrategicPlan = {
          goal: parsed.goal || task,
          phases: parsed.phases.map((phase) => ({
            name: phase.name || 'Fase',
            description: phase.description || '',
            successCriteria: phase.successCriteria || '',
            subGoals: phase.subGoals || [],
            currentSubGoalIndex: 0,
            estimatedSteps: phase.estimatedSteps || 15,
            status: 'pending' as const,
          })),
          currentPhaseIndex: 0,
          totalEstimatedSteps: parsed.totalEstimatedSteps || 50,
        };
        strategicPlan.phases[0].status = 'in_progress';
        strategicPlan.phases[0].startStep = 0;

        const firstPhase = strategicPlan.phases[0];
        return {
          strategicPlan,
          taskPlan: {
            goal: parsed.goal || task,
            subGoals: firstPhase.subGoals,
            currentSubGoalIndex: 0,
            estimatedSteps: strategicPlan.totalEstimatedSteps,
            replannedCount: 0,
          },
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[DesktopAgent] Hierarchical planning failed, falling back to flat: ${message}`);
    }
  }

  const model = ai.getGenerativeModel({ model: config.model });
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
      { text: buildFlatPlanPrompt(task) },
    ]);
    const parsed = parseVisionResponse(result.response.text()) as ParsedPlan;
    return {
      strategicPlan: null,
      taskPlan: {
        goal: parsed.goal || task,
        subGoals: parsed.subGoals || [task],
        currentSubGoalIndex: 0,
        estimatedSteps: parsed.estimatedSteps || 20,
        replannedCount: 0,
      },
    };
  } catch {
    return {
      strategicPlan: null,
      taskPlan: { goal: task, subGoals: [task], currentSubGoalIndex: 0, estimatedSteps: 30, replannedCount: 0 },
    };
  }
}
