import { createDesktopTaskPlan } from './plan-runtime';
import { summarizeDesktopHistory } from './history-summary-runtime';
import { checkStrategicPhaseCompletion } from './phase-runtime';
import { runDesktopVisionStep } from './vision-step-runtime';
import {
  applyServiceSmartDelay,
  executeServiceDesktopAction,
  runServiceProactiveRecovery,
} from './service-action-runtime';
import type { DesktopActionPayload, TaskPlan } from '../desktop-agent-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from './service-types';

export interface DesktopAgentPlanningApi {
  proactiveRecovery(task: string, screenshotBase64: string, reason: 'stuck' | 'fail' | 'failures', failMessage?: string): Promise<boolean>;
  visionStep(task: string, screenshotBase64: string, useFallback?: boolean, recoveryContext?: boolean): Promise<DesktopActionPayload>;
  createPlan(task: string, screenshotBase64: string): Promise<TaskPlan>;
  summarizeHistory(): Promise<void>;
  checkPhaseCompletion(task: string): Promise<void>;
  executeAction(action: DesktopActionPayload): Promise<void>;
  smartDelay(action: DesktopActionPayload): Promise<void>;
  delay(ms: number): Promise<void>;
}

export function attachDesktopAgentPlanning(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    proactiveRecovery(task, screenshotBase64, reason, failMessage) {
      console.log(`[DesktopAgent] Recuperacion proactiva solicitada - razon: ${reason}`);
      return runServiceProactiveRecovery(this, { task, screenshotBase64, reason, failMessage });
    },
    visionStep(task, screenshotBase64, useFallback = false, recoveryContext = false) {
      return runDesktopVisionStep({
        task,
        screenshotBase64,
        useFallback,
        recoveryContext,
        ai: this.getGenAI(),
        config: this.config,
        actionHistory: this.actionHistory,
        strategicPlan: this.strategicPlan,
        currentPlan: this.currentPlan,
        recovery: this.recovery,
        historySummaries: this.historySummaries,
        lastZoomImage: this.lastZoomImage,
        consumeLastZoomImage: () => { this.lastZoomImage = null; },
        captureMode: this.captureMode,
        currentUIElements: this.currentUIElements,
        screenshotWidth: this.lastActualScreenshotWidth || this.config.screenshotWidth,
        screenshotHeight: this.lastActualScreenshotHeight || this.config.screenshotHeight,
        monitorContext: this.describeScreenshotMonitorContext(),
        currentStep: this.currentStep,
      });
    },
    async createPlan(task, screenshotBase64) {
      const { taskPlan, strategicPlan } = await createDesktopTaskPlan({ ai: this.getGenAI(), config: this.config, task, screenshotBase64 });
      this.strategicPlan = strategicPlan;
      if (strategicPlan) {
        console.log(`[DesktopAgent] Plan estrategico: ${strategicPlan.phases.length} fases, ~${strategicPlan.totalEstimatedSteps} pasos`);
        this.emit('strategic-plan-created', strategicPlan);
      }
      return taskPlan;
    },
    summarizeHistory() {
      return summarizeDesktopHistory({
        ai: this.getGenAI(),
        modelName: this.config.model,
        actionHistory: this.actionHistory,
        currentStep: this.currentStep,
        historySummaries: this.historySummaries,
      });
    },
    async checkPhaseCompletion(_task) {
      await checkStrategicPhaseCompletion({
        ai: this.getGenAI(),
        modelName: this.config.proactiveModel,
        screenshotBase64: await this.takeScreenshotRaw(),
        strategicPlan: this.strategicPlan,
        currentPlan: this.currentPlan,
        currentStep: this.currentStep,
        emit: (eventName, payload) => { this.emit(eventName, payload); },
      });
    },
    executeAction(action) {
      return executeServiceDesktopAction(this, action);
    },
    smartDelay(action) {
      return applyServiceSmartDelay(this, action);
    },
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  } satisfies DesktopAgentPlanningApi & ThisType<DesktopAgentService>);
}
