import { inferDesktop, type DesktopInference } from './inference';
import type { AgentStatus, DesktopAgentConfig, DesktopAgentStatus } from '../desktop-agent-types';
import { normalizeDesktopAgentConfig, saveConfig } from '../desktop-agent-types';
import type { BrowserProfileDescriptor } from '../browser-web/types';
import type { DesktopAgentService } from '../desktop-agent-service';
import { buildDesktopAgentStatus } from './status-snapshot';
import { abortDesktopAgentTask } from './task-control';
import { abortBrowserCuTask, getBrowserCuTask } from './browser-cu-task';
import type { DesktopAgentServiceConstructor } from './service-types';
import { desktopConfigUpdates, desktopInputSnapshot } from '../../src/shared/desktop-input';

type BrowserProfileResetResult = { success: boolean; profileId: string; path: string; removed: boolean };

export interface DesktopAgentLifecycleApi {
  generateTaskId(): string;
  setApiKey(key: string): void;
  getInference(): DesktopInference;
  getConfig(): DesktopAgentConfig;
  setConfig(updates: Partial<DesktopAgentConfig>): void;
  getStatus(): DesktopAgentStatus;
  abort(taskId?: string): void;
  abortAll(): void;
  isRunning(): boolean;
  getActiveTaskCount(): number;
  listBrowserProfiles(): BrowserProfileDescriptor[];
  resetBrowserProfile(profileId: string): Promise<BrowserProfileResetResult>;
}

export function attachDesktopAgentLifecycle(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    generateTaskId() {
      return `agent-${++this.taskIdCounter}-${Date.now().toString(36)}`;
    },
    setApiKey(key: string) {
      this.apiKey = key;
      this.browserWeb.setApiKey(key);
      this.windowsUIA.setApiKey(key);
    },
    getInference() { return inferDesktop; },
    getConfig() {
      return { ...this.config };
    },
    setConfig(updates: Partial<DesktopAgentConfig>) {
      const [snapshot] = desktopInputSnapshot([updates]);
      const validated = desktopConfigUpdates.parse(snapshot);
      const next = normalizeDesktopAgentConfig({ ...this.config, ...validated });
      saveConfig(next);
      this.config = next;
      this.emit('config-updated', this.config);
    },
    getStatus() {
      return buildDesktopAgentStatus({
        activeTasks: this.activeTasks.values(),
        browserStatus: getBrowserCuTask(this) ?? this.browserWeb.getStatus(),
        windowsUIAStatus: this.windowsUIA.getStatus(),
        actionHistory: this.actionHistory,
        status: this.status,
        currentTask: this.currentTask,
        currentStep: this.currentStep,
        currentPlan: this.currentPlan,
        config: this.getConfig(),
        platformCapabilities: this.platformCapabilities,
      });
    },
    abort(taskId?: string) {
      this.visualGuidance?.clear();
      const cancelledCu = abortBrowserCuTask(this, taskId);
      if (taskId && cancelledCu) return;
      abortDesktopAgentTask({
        taskId,
        queue: this.taskQueue,
        activeTasks: this.activeTasks,
        abortController: this.abortController,
        abortBrowserTasks: () => this.browserWeb.abortAll(),
        abortWindowsUIATasks: () => this.windowsUIA.abortAll(),
        stopObservation: () => this.stopObservation(),
        processQueue: () => this.processQueue(),
        emit: (eventName: string, payload?: unknown) => { this.emit(eventName, payload); },
      });
    },
    abortAll() {
      this.abort();
    },
    isRunning() {
      return this.status !== 'idle' || this.activeTasks.size > 0 || Boolean(getBrowserCuTask(this)) || this.browserWeb.isRunning() || this.windowsUIA.isRunning();
    },
    getActiveTaskCount() {
      return this.activeTasks.size + (getBrowserCuTask(this) ? 1 : 0) + (this.browserWeb.isRunning() ? 1 : 0) + (this.windowsUIA.isRunning() ? 1 : 0);
    },
    listBrowserProfiles() {
      return this.browserWeb.listProfiles();
    },
    resetBrowserProfile(profileId: string) {
      return this.browserWeb.resetProfile(profileId);
    },
  } satisfies DesktopAgentLifecycleApi & ThisType<DesktopAgentService & { status: AgentStatus }>);
}
