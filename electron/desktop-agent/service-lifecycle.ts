import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgentStatus, DesktopAgentConfig, DesktopAgentStatus } from '../desktop-agent-types';
import { normalizeDesktopAgentConfig, saveConfig } from '../desktop-agent-types';
import type { BrowserProfileDescriptor } from '../browser-web/types';
import type { DesktopAgentService } from '../desktop-agent-service';
import { buildDesktopAgentStatus } from './status-snapshot';
import { abortDesktopAgentTask } from './task-control';
import type { DesktopAgentServiceConstructor } from './service-types';

type BrowserProfileResetResult = { success: boolean; profileId: string; path: string; removed: boolean };

export interface DesktopAgentLifecycleApi {
  generateTaskId(): string;
  setApiKey(key: string): void;
  getGenAI(): GoogleGenerativeAI;
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
      this.genAI = null;
      this.browserWeb.setApiKey(key);
      this.windowsUIA.setApiKey(key);
    },
    getGenAI() {
      if (!this.apiKey) throw new Error('Gemini API key no configurada para DesktopAgent');
      if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.apiKey);
      return this.genAI;
    },
    getConfig() {
      return { ...this.config };
    },
    setConfig(updates: Partial<DesktopAgentConfig>) {
      this.config = normalizeDesktopAgentConfig({ ...this.config, ...updates });
      saveConfig(this.config);
      this.emit('config-updated', this.config);
    },
    getStatus() {
      return buildDesktopAgentStatus({
        activeTasks: this.activeTasks.values(),
        browserStatus: this.browserWeb.getStatus(),
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
      abortDesktopAgentTask({
        taskId,
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
      return this.status !== 'idle' || this.activeTasks.size > 0 || this.browserWeb.isRunning() || this.windowsUIA.isRunning();
    },
    getActiveTaskCount() {
      return this.activeTasks.size + (this.browserWeb.isRunning() ? 1 : 0) + (this.windowsUIA.isRunning() ? 1 : 0);
    },
    listBrowserProfiles() {
      return this.browserWeb.listProfiles();
    },
    resetBrowserProfile(profileId: string) {
      return this.browserWeb.resetProfile(profileId);
    },
  } satisfies DesktopAgentLifecycleApi & ThisType<DesktopAgentService & { status: AgentStatus }>);
}
